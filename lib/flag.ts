import { captureCurrentSourceDir } from "./env.ts"
import { fs_exists } from "@util/node.ts"
import type { Expand } from "@util/type.ts"
import { sourceRoot } from "./file.ts"
import { resolvePath } from "./path.ts"

export const flagBus = new Map<string, FlagExchange>()

type FlagExchange =
	| { stage: "requested" }
	| { stage: "provided"; value: unknown }
	| { stage: "consumed" }

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
		const exchange = 	flagBus.get(key)
		if (exchange) {
			if (exchange.stage === "requested" || exchange.stage === "consumed") {
				throw new Error(`Duplicate flag declaration: "${key}".`)
			}
		} else {
			flagBus.set(key, { stage: "requested" })
		}
	}

	const currentSourceDir = captureCurrentSourceDir()
	const dirCandidates = [sourceRoot, currentSourceDir]
	const basenameCandidates = [
		"flags.neja.ts",
		"flags.neja.js",
		"flags.local.neja.ts",
		"flags.local.neja.js",
	]
	const importPaths = await Promise.all(
		basenameCandidates.flatMap((basename) =>
			dirCandidates.map(async (dir) => {
				const candidatePath = resolvePath(dir, basename)
				if (await fs_exists(candidatePath)) {
					return candidatePath
				} else {
					return null
				}
			}),
		),
	)

	for (const importPath of importPaths) {
		if (importPath) {
			await import(importPath)
		}
	}

	const result = {} as Record<string, unknown>

	for (const [key, schemaValue] of Object.entries(schema)) {
		const exchange = flagBus.get(key)
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

		flagBus.set(key, { stage: "consumed" })
	}

	return result as ResolvedFlags<S>
}

export function setFlags<T extends ResolvedFlags>(flags: T): void {
	for (const [key, value] of Object.entries(flags)) {
		const exchange = flagBus.get(key)
		if (exchange) {
			if (exchange.stage === "provided" || exchange.stage === "consumed") {
				throw new Error(`Duplicate flag provision: "${key}".`)
			}
		}
		flagBus.set(key, { stage: "provided", value })
	}
}
