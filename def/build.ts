import { type FileItem } from "./file.ts"

export const allBuilds = new Array<Build>()

export abstract class Build {
	static buildClass: typeof Build
	static vars: Record<string, RuleVar> | null
	static ninjaRules: Map<string, NinjaRule>

	ins: readonly FileItem[] = []
	outs: readonly FileItem[] = []
	exportName: string = ""

	constructor() {
		// Static initialization runs on first instantiation, because we need the most specific
		// subclass for some states.
		const buildClass = this.buildClass
		if (buildClass.buildClass !== buildClass) {
			buildClass.buildClass = buildClass
			buildClass.vars = null
			buildClass.ninjaRules = new Map()
		}

		allBuilds.push(this)
	}

	get buildClass(): typeof Build {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return Object.getPrototypeOf(this).constructor as typeof Build
	}

	get vars(): { [key in keyof this]: RuleVar } {
		// Cached at class level, but computed at instance level because only then we have all
		// the properties.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return (this.buildClass.vars ||= Object.fromEntries(
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

	abstract rule(): {
		command: string
		name?: string
		description?: string
	}
}

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
	vars: string[]
}
