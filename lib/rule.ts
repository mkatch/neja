import type { FileItem } from "./file.ts"
import { buildRoot, File } from "./file.ts"
import { fileArray, fileItemArray } from "./pipes/array.ts"
import { singleFile } from "./pipes/single.ts"

export const allRules = new Array<Rule>()

const EXPORT_NAME_PATTERN = /^\w*$/
const RULE_PRIVATE_KEY = Symbol("Rule private")

export abstract class Rule {
	static ruleClass: typeof Rule
	static vars: Record<string, RuleVar> | null
	static ninjaRules: Map<string, NinjaRule>

	ins: readonly FileItem[] = []
	outs: readonly FileItem[] = []
	implicitIns = fileItemArray()
	orderOnlyIns = fileItemArray()
	exportingFile: File | null = null
	alwaysDirty = false
	ninjaRule: NinjaRule | null = null

	constructor() {
		// Static initialization runs on first instantiation, because we need the most specific
		// subclass for some states.
		const ruleClass = this.ruleClass
		if (ruleClass.ruleClass !== ruleClass) {
			ruleClass.ruleClass = ruleClass
			ruleClass.vars = null
			ruleClass.ninjaRules = new Map()
		}

		(this as unknown as { [RULE_PRIVATE_KEY]: RulePrivate })[RULE_PRIVATE_KEY] = {
			exportName: "",
		}

		allRules.push(this)
	}

	get ruleClass(): typeof Rule {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return Object.getPrototypeOf(this).constructor as typeof Rule
	}

	get exportName(): string {
		return Rule_private(this).exportName
	}

	set exportName(value: string) {
		if (!EXPORT_NAME_PATTERN.test(value)) {
			throw new Error(
				`Invalid export name "${value}". Export names must consist exclusively of letters, numbers, and underscores.`,
			)
		}
		Rule_private(this).exportName = value
	}

	get vars(): { [key in keyof this]: RuleVar } {
		// Cached at class level, but computed at instance level because only then we have all
		// the properties.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return (this.ruleClass.vars ||= Object.fromEntries(
			Object.keys(this).map((key) => {
				let ninjaName: string
				if (key === "ins") {
					ninjaName = "in"
				} else if (key === "outs") {
					ninjaName = "out"
				} else {
					ninjaName = key
				}
				return [key, new RuleVar(ninjaName)]
			}),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		) as any)
	}

	effect(): void {}

	abstract command(): {
		command: string
		name?: string
		description?: string
		depfile?: string
		generator?: boolean
	}
}

interface RulePrivate {
	exportName: string
}

// Simple `private` doesn't work due to https://github.com/microsoft/TypeScript/issues/30355
function Rule_private(rule: Rule): RulePrivate {
	return (rule as unknown as { [RULE_PRIVATE_KEY]: RulePrivate })[RULE_PRIVATE_KEY]
}

export const rerun = new (class RerunNeja extends Rule {
	mainNejafile = singleFile()
	outs = fileArray()
	commandBase = ""

	command() {
		if (!this.mainNejafile.item) {
			throw new Error("RerunNeja requires the main Nejafile.")
		}
		if (!this.commandBase) {
			throw new Error("RerunNeja requires the neja command base.")
		}

		this.ins = [this.mainNejafile.item]

		const { ins } = this.vars

		return {
			command: `${this.commandBase} -f ${ins} --chdir=${buildRoot}`,
			description: "Rerun neja",
			generator: true,
		}
	}
})()

export class RuleVar {
	ninjaName: string
	constructor(ninjaName: string) {
		this.ninjaName = ninjaName
	}
	toString() {
		return `\${${this.ninjaName}}`
	}
}

export type NinjaRule = {
	baseName: string
	uniqueName: string
	command: string
	description: string
	depfile: string
	vars: string[]
	generator: boolean
}
