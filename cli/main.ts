import * as path from "path"
import { neja } from "neja"
import { drainBuilds } from "./gen.ts"

async function main(): Promise<void> {
	const params = parseArgs()

	const projectFile = path.resolve(params.file)
	const sourceDir = path.dirname(projectFile)

	if (params.chdir) {
		process.chdir(params.chdir)
	}
	const buildDir = process.cwd()

	neja.config.sourceDir = sourceDir
	neja.config.buildDir = buildDir

	const project = (await import(projectFile)) as object

	for (const [k, v] of Object.entries(project)) {
		if (v instanceof neja.Build) {
			v.exportName ||= k
		}
	}

	await drainBuilds({ sourceDir, buildDir })
}

// NOTE: I wanted to use commander, but it is CommonJS and doesn't work well with esbuild+ESM. I'm
// not gonna waste time on making it work, so let's do a simple ad-hoc parser for now.
function parseArgs(): {
	file: string
	chdir?: string
} {
	const result: Partial<ReturnType<typeof parseArgs>> = {}

	for (let i = 2; i < process.argv.length; ++i) {
		const arg = process.argv[i]
		if (arg.startsWith("-")) {
			let argName: string
			let argValue: string

			const valueSeparatorIndex = arg.indexOf("=")
			if (valueSeparatorIndex === -1) {
				argName = arg
				++i
				argValue = process.argv[i]
			} else {
				argName = arg.slice(0, valueSeparatorIndex)
				argValue = arg.slice(valueSeparatorIndex + 1)
			}

			switch (argName) {
				case "-f":
				case "--file": {
					result.file = argValue
					break
				}

				case "-C":
				case "--chdir": {
					result.chdir = argValue
					break
				}
			}
		} else {
			// We don't have positional args yet.
		}
	}

	return {
		file: "neja.ts",
		...result,
	}
}

await main()
