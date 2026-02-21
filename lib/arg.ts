import * as nodeUtil from "util"

export let argv!: string[]

export function arg_init(params: { argv: string[] }) {
	argv = params.argv
}

export type parseArgs_Specs = Record<string, parseArgs_Specs_Arg>

export type parseArgs_Specs_Arg =
	| { type: "boolean" }
	| { type: "string"; multiple?: boolean }
	| { type: "enum"; values: readonly string[]; multiple?: boolean }

export type parseArgs_Result<S extends parseArgs_Specs> = {
	[key in keyof S]?: parseArgs_Result_Arg<S[key]>
} & {}

export type parseArgs_Result_Arg<A extends parseArgs_Specs_Arg> = A extends { type: "boolean" }
	? boolean
	: A extends { type: "string" }
		? A["multiple"] extends true
			? string[]
			: string
		: A extends { type: "enum" }
			? A["multiple"] extends true
				? A["values"][number][]
				: A["values"][number]
			: never

export function parseArgs<S extends parseArgs_Specs>(specs: S): parseArgs_Result<S> {
	const enumArgs: Record<string, readonly string[]> = {}

	const nodeOptions: nodeUtil.ParseArgsOptionsConfig = {}
	for (const [key, arg] of Object.entries(specs)) {
		if (arg.type === "boolean") {
			nodeOptions[key] = { type: "boolean" }
		} else {
			nodeOptions[key] = { type: "string", multiple: !!arg.multiple }
			if (arg.type === "enum") {
				enumArgs[key] = arg.values
			}
		}
	}
	const nodeParsed = nodeUtil.parseArgs({
		args: argv,
		options: nodeOptions,
		strict: false,
		allowNegative: true,
		allowPositionals: false,
		tokens: true,
	})

	for (const [key, value] of Object.entries(nodeParsed.values)) {
		if (value === undefined) {
			continue
		}
		const enumValues = enumArgs[key]
		if (!enumValues) {
			continue
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				parseArgs_checkEnumValue(key, item, enumValues)
			}
		} else {
			parseArgs_checkEnumValue(key, value, enumValues)
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
	return nodeParsed.values as unknown as any
}

function parseArgs_checkEnumValue(
	key: string,
	value: unknown,
	allowedValues: readonly unknown[],
): void {
	if (!allowedValues.includes(value)) {
		throw new Error(
			`Invalid value for argument --${key}: ${value}. Allowed values are: ${allowedValues.join(", ")}`,
		)
	}
}
