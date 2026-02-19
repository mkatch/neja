import * as path from "path"
import type { neja } from "@lib"
import { UniqueNameResolver } from "./unique_name_resolver.ts"

const uniqueAnonTargetNames = new UniqueNameResolver()

export function formatRuleChunk(rule: neja.NinjaRule): string {
	const { uniqueName, command, description, depfile, generator } = rule
	let chunk = `rule ${uniqueName}\n  command = ${command}\n`
	if (description) {
		chunk += `  description = ${description}\n`
	}
	if (depfile) {
		chunk += `  depfile = ${depfile}\n`
	}
	if (generator) {
		chunk += `  generator = 1\n`
	}
	chunk += "\n"
	return chunk
}

export function formatBuildChunk(rule: neja.Rule, ninjaRule: neja.NinjaRule): string {
	let chunk = ""
	let outsChunk = rule.outs.map((o) => `${o}`).join(" ")

	if (rule.exportName) {
		const outsIncludeExportName = rule.outs.some((out) => `${out}` === rule.exportName)
		if (outsIncludeExportName) {
			if (rule.outs.length > 1) {
				throw new Error(
					`If you want the name of exported target "${rule.exportName}" to coincide with one of its outputs, it cannot have any other outputs.`,
				)
			}
			// The export name matches the output exactly, so nothing to do here as it will be handled by
			// the general case.
		} else if (rule.outs.length > 0) {
			chunk += `build ${rule.exportName}: phony ${outsChunk}\n\n`
		} else {
			outsChunk = rule.exportName
		}
	} else if (rule.outs.length === 0) {
		const uniqueName = uniqueAnonTargetNames.claim(rule.ruleClass.name)
		outsChunk = path.join("anon", uniqueName)
	}

	chunk += `build ${outsChunk}: ${ninjaRule.uniqueName}`

	if (rule.ins.length > 0) {
		const insChunk = rule.ins.map((i) => `${i}`).join(" ")
		chunk += ` ${insChunk}`
	}

	const formattedImplicitIns = new Array<string>()
	if (rule.alwaysDirty) {
		formattedImplicitIns.push("always_dirty")
	}
	for (const implicitIn of rule.implicitIns) {
		formattedImplicitIns.push(`${implicitIn}`)
	}

	if (formattedImplicitIns.length > 0) {
		const implicitInsChunk = formattedImplicitIns.join(" ")
		chunk += ` | ${implicitInsChunk}`
	}

	const values = rule as unknown as Record<string, unknown>
	for (const key of ninjaRule.vars) {
		const value = values[key]
		if (value !== undefined) {
			chunk += `\n  ${key} = ${value as unknown}`
		}
	}

	chunk += "\n\n"
	return chunk
}
