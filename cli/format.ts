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

	for (const inItem of rule.ins) {
		chunk += ` ${inItem}`
	}

	if (rule.alwaysDirty || rule.implicitIns.length > 0) {
		chunk += " |"
	}
	if (rule.alwaysDirty) {
		chunk += " always_dirty"
	}
	for (const implicitIn of rule.implicitIns) {
		chunk += ` ${implicitIn}`
	}

	if (rule.orderOnlyIns.length > 0) {
		chunk += " ||"
	}
	for (const orderOnlyIn of rule.orderOnlyIns) {
		chunk += ` ${orderOnlyIn}`
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
