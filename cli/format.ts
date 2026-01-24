import * as path from "path"
import { type Build, type NinjaRule } from "../def/build.ts"
import { UniqueNameResolver } from "./unique_name_resolver.ts"

const uniqueAnonBuildNames = new UniqueNameResolver()

export function formatRuleChunk(rule: NinjaRule): string {
	const { uniqueName, command, description } = rule
	let chunk = `rule ${uniqueName}\n  command = ${command}\n`
	if (description) {
		chunk += `  description = ${description}\n`
	}
	chunk += "\n"
	return chunk
}

export function formatBuildChunk(build: Build, rule: NinjaRule): string {
	let chunk = ""
	let outsChunk = build.outs.map((o) => `${o}`).join(" ")

	if (build.exportName) {
		const outsIncludeExportName = build.outs.some((out) => `${out}` === build.exportName)
		if (outsIncludeExportName) {
			if (build.outs.length > 1) {
				throw new Error(
					`If you want the name of exported target "${build.exportName}" to coincide with one of its outputs, it cannot have any other outputs.`,
				)
			}
			// The export name matches the output exactly, so nothing to do here as it will be handled by
			// the general case.
		} else if (build.outs.length > 0) {
			chunk += `build ${build.exportName}: phony ${outsChunk}\n\n`
		} else {
			outsChunk = build.exportName
		}
	} else if (build.outs.length === 0) {
		const uniqueName = uniqueAnonBuildNames.claim(build.buildClass.name)
		outsChunk = path.join("anon", uniqueName)
	}

	const insChunk = build.ins.map((i) => `${i}`).join(" ")
	chunk += `build ${outsChunk}: ${rule.uniqueName} ${insChunk}\n`

	const values = build as unknown as Record<string, unknown>
	for (const key of rule.vars) {
		const value = values[key]
		chunk += `  ${key} = ${value}\n`
	}

	chunk += "\n"
	return chunk
}
