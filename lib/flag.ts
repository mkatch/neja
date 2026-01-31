import * as path from "path"
import { captureAbsoluteCurrentNejaFilePath, config } from "./env.ts"
import { fs_exists } from "../util/node.ts"
import type { Expand } from "../util/type.ts"

const FlagSchema_valueType = Symbol("FlagSchema_type")
type FlagSchemaValue<T> = {
	defaultValue?: T
	readonly [FlagSchema_valueType]: T
}

export function flag<T>(params: { required: true } | { defaultValue: T }): FlagSchemaValue<T> {
	if ("required" in params) {
		return {} as FlagSchemaValue<T>
	} else {
		return { defaultValue: params.defaultValue } as FlagSchemaValue<T>
	}
}

type FlagSchema = Record<string, FlagSchemaValue<unknown>>

type ResolvedFlags<S extends FlagSchema = FlagSchema> = {
	[key in keyof S]: S[key][typeof FlagSchema_valueType]
}

export async function resolveFlags<S extends FlagSchema>(
	schema: S,
): Promise<Expand<ResolvedFlags<S>>> {
	for (const key of Object.keys(schema)) {
		const exchange = config.flagBus.get(key)
		if (exchange) {
			if (exchange.stage === "requested" || exchange.stage === "consumed") {
				throw new Error(`Duplicate flag declaration: "${key}".`)
			}
		} else {
			config.flagBus.set(key, { stage: "requested" })
		}
	}

	const currentNejaFilePath = captureAbsoluteCurrentNejaFilePath()
	const currentSourceDir = path.dirname(currentNejaFilePath)

	const flagFilePathCandidates = [
		path.join(config.sourceDir, "flags.neja.ts"),
		path.join(config.sourceDir, "flags.neja.js"),
		path.join(currentSourceDir, "flags.neja.ts"),
		path.join(currentSourceDir, "flags.neja.js"),
	]
	await Promise.all(
		flagFilePathCandidates.map(async (flagFilePath) => {
			if (await fs_exists(flagFilePath)) {
				await import(flagFilePath)
			}
		}),
	)

	const result = {} as Record<string, unknown>

	for (const [key, schemaValue] of Object.entries(schema)) {
		const exchange = config.flagBus.get(key)
		if (!exchange) {
			throw new Error(`Internal error. No flag exchange for key: ${key}.`)
		}
		if (exchange.stage === "consumed") {
			throw new Error(`Internal error. Flag ${key} already consumed.`)
		}

		if (exchange.stage === "provided") {
			result[key] = exchange.value
		} else if ("defaultValue" in schemaValue) {
			result[key] = schemaValue.defaultValue
		} else {
			throw new Error(`Required flag "${key}" was not provided.`)
		}

		config.flagBus.set(key, { stage: "consumed" })
	}

	return result as ResolvedFlags<S>
}

export function setFlags<T extends ResolvedFlags>(flags: T): void {
	for (const [key, value] of Object.entries(flags)) {
		const exchange = config.flagBus.get(key)
		if (exchange) {
			if (exchange.stage === "provided" || exchange.stage === "consumed") {
				throw new Error(`Duplicate flag provision: "${key}".`)
			}
		}
		config.flagBus.set(key, { stage: "provided", value })
	}
}
