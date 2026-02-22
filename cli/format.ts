import type { neja } from "@lib"

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

	let outsChunk = rule.outs.map((outItem) => `${outItem}`).join(" ")

	if (rule.exportName) {
		if (!outsChunk) {
			outsChunk = rule.exportName
		} else {
			chunk += `build ${rule.exportName}: phony ${outsChunk}\n`
		}
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

export function formatDefaultTargets(defaultTargets: Set<neja.Rule>): string {
	if (defaultTargets.size === 0) {
		return ""
	}

	let chunk = "default"

	for (const rule of defaultTargets) {
		if (rule.exportName) {
			chunk += ` ${rule.exportName}`
		} else {
			chunk += ` ${rule.outs.map((outItem) => `${outItem}`).join(" ")}`
		}
	}

	chunk += "\n\n"
	return chunk
}
