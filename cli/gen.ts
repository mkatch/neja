import * as fs from "fs"
import { neja } from "@lib"
import { Array_sortAndRemoveDuplicates } from "@util/array.ts"
import { WriteStream_submit } from "@util/node.ts"
import { UniqueNameResolver } from "./unique_name_resolver.ts"
import { formatBuildChunk, formatDefaultTargets, formatRuleChunk } from "./format.ts"

const COMMAND_PARAM_PATTERN = /([^$]|^)\${([^}]+)}/gm
const uniqueRuleNames = new UniqueNameResolver()
const uniqueAnonTargetNames = new UniqueNameResolver()
const globalVars: Record<string, neja.RuleVar> = {}
const allNinjaRules = new Array<neja.NinjaRule>()
const defaultTargets = new Set<neja.Rule>()

export async function processImports(imports: string[]): Promise<void> {
	const nejafiles = new Array<{
		file: neja.File
		importUrl: string
	}>()

	for (const fileUrl of imports) {
		const nejafile = neja.maybeNejafile(fileUrl)
		if (nejafile) {
			nejafiles.push({ file: nejafile, importUrl: fileUrl })
		}
	}

	// Sorting for two reasons:
	//  1. In case a target is re-exported from multiple files, we want to infer the name from the
	//     highest one.
	//  2. Deterministic output, as the files are included as the dependencies for thee "rerun"
	//     statement
	nejafiles.sort((a, b) => (a.file.path < b.file.path ? -1 : 1))

	for (const { file: nejafile, importUrl } of nejafiles) {
		neja.pipe(nejafile, neja.rerun.implicitIns)

		// Completes immediately because it was already imported.
		const module = (await import(importUrl)) as object

		let defaultExport: unknown

		for (const [key, value] of Object.entries(module)) {
			if (key === "default") {
				defaultExport = value
			} else if (value instanceof neja.Rule) {
				value.exportingFile ||= nejafile
				value.exportName ||= key
			}
		}

		// Normal exports take priority over default exports for `exportName` inference.
		if (defaultExport) {
			if (defaultExport instanceof neja.Rule) {
				defaultExport.exportingFile ||= nejafile
				defaultTargets.add(defaultExport)
			} else if (typeof defaultExport === "object") {
				for (const [key, value] of Object.entries(defaultExport)) {
					if (value instanceof neja.Rule) {
						value.exportingFile ||= nejafile
						value.exportName ||= key
						defaultTargets.add(value)
					}
				}
			}
		}
	}
}

export async function executeRuleEffects(): Promise<void> {
	const { allRules } = neja.internal

	for (let i = 0; i < allRules.length; ++i) {
		const rule = allRules[i]

		if (rule.effect !== neja.Rule.prototype.effect) {
			// Call conditionally to improve parallelism.
			await neja.drainDiscoveryTasks()
			rule.effect()
		}
	}

	for (const rule of allRules) {
		if (rule.outs.length === 0 && !rule.exportName) {
			// Conflicts with maliciously crafter user names still possible, but we don't care. They will be
			// flagged by Ninja.
			rule.exportName = uniqueAnonTargetNames.claim(rule.ruleClass.name)
		}
	}
}

export function resolveRules(): void {
	// TODO: This should go in a different spot and also be controllable from user code.
	globalVars.sourcedir = new neja.RuleVar("sourcedir")
	globalVars.builddir = new neja.RuleVar("builddir")

	const { allRules } = neja.internal
	const ruleCount = allRules.length
	for (let i = 0; i < ruleCount; ++i) {
		const rule = allRules[i]
		resolveRules_single(rule)
	}

	if (allRules.length > ruleCount) {
		// TODO: Should probably be done actively in the Rule constructor. We should also cover other
		// prohibited operations.
		throw new Error("New rules were added while resolving rules.")
	}
}

function resolveRules_single(rule: neja.Rule): void {
	// We later hack those, so disallow to avoid problems.
	if ("in" in rule || "out" in rule) {
		throw new Error('Properties "in" and "out" are reserved.')
	}

	const ruleClass = rule.ruleClass

	const {
		command,
		description = "",
		name: baseName = ruleClass.name || rule.exportName,
		depfile = "",
		generator = false,
	} = rule.command()

	const ninjaRules = ruleClass.ninjaRules
	let ninjaRule = ninjaRules.get(command)

	if (!ninjaRule) {
		const availableVars = rule.vars
		const usedVars = new Array<string>()
		resolveRules_scanVars(availableVars, command, usedVars)
		resolveRules_scanVars(availableVars, description, usedVars)
		resolveRules_scanVars(availableVars, depfile, usedVars)
		Array_sortAndRemoveDuplicates(usedVars)

		const uniqueName = uniqueRuleNames.claim(baseName)

		ninjaRule = {
			baseName,
			uniqueName,
			command,
			description,
			depfile,
			vars: usedVars,
			generator,
		}
		ninjaRules.set(command, ninjaRule)
		allNinjaRules.push(ninjaRule)
	} else {
		if (ninjaRule.baseName !== baseName) {
			throw new Error("Ninja rule name mismatch for the same command.")
		}
		if (ninjaRule.description !== description) {
			throw new Error("Ninja rule description mismatch for the same command.")
		}
		if (ninjaRule.depfile !== depfile) {
			throw new Error("Ninja rule depfile mismatch for the same command.")
		}
		if (ninjaRule.generator !== generator) {
			throw new Error("Ninja rule generator flag mismatch for the same command.")
		}
	}

	rule.ninjaRule = ninjaRule
}

function resolveRules_scanVars(
	availableVars: Record<string, neja.RuleVar>,
	text: string,
	usedVars: string[],
) {
	for (const match of text.matchAll(COMMAND_PARAM_PATTERN)) {
		const key = match[2]

		// They are implicit
		if (key === "in" || key === "out") {
			continue
		}

		if (!(key in availableVars)) {
			if (key in globalVars) {
				continue
			}
			throw new Error(`Unrecognized variable: \${${key}}`)
		}

		usedVars.push(key)
	}
}

export async function writeNinjaFile(ninjaFile: neja.File): Promise<void> {
	const out = fs.createWriteStream(ninjaFile.path, { encoding: "utf-8" })
	try {
		await writeNinjaFile_impl(out)
	} finally {
		out.end()
	}
}

async function writeNinjaFile_impl(out: fs.WriteStream): Promise<void> {
	await WriteStream_submit(
		out,
		`# Generated by neja\n\n` +
			`sourcedir = ${neja.sourceRoot.path}\n` +
			`builddir = ${neja.buildRoot.path}\n\n`,
	)

	const defaultTargetsChunk = formatDefaultTargets(defaultTargets)
	await WriteStream_submit(out, defaultTargetsChunk)

	await WriteStream_submit(out, `### Rules ###\n\n`)

	for (const ninjaRule of allNinjaRules) {
		const ruleChunk = formatRuleChunk(ninjaRule)
		await WriteStream_submit(out, ruleChunk)
	}

	await WriteStream_submit(
		out,
		`### Build statements ###\n\n` + //
			`build always_dirty: phony\n\n`,
	)

	for (const rule of neja.internal.allRules) {
		const buildChunk = formatBuildChunk(rule, rule.ninjaRule!)
		await WriteStream_submit(out, buildChunk)
	}
}
