import * as path from "path"
import { neja } from "neja"
import { createOutputStreams, drainBuilds, resolveRules, writeHeaders } from "./gen.ts"
import { fs_symlink } from "@util/node.ts"

export default async function main(imports: string[]): Promise<void> {
	const params = parseArgs()

	const absProjectFilePath = path.resolve(params.file)
	const sourceDirPath = path.dirname(absProjectFilePath)
	const relProjectFilePath = path.basename(absProjectFilePath)

	const buildDirLinkPath = path.join(sourceDirPath, ".neja-build")

	if (params.chdir) {
		process.chdir(params.chdir)
	}
	const buildDir = process.cwd()

	await fs_symlink(buildDir, buildDirLinkPath, {
		type: "dir",
		recursivelyCreateDirs: true,
		overrideIfExistsAsLink: true,
	})

	neja.config.sourceDir = sourceDirPath
	neja.config.buildDir = buildDir

	const projectFile = neja.sourceFile(relProjectFilePath)
	neja.rerun.mainNejafile.onFileItem(projectFile)

	neja.rerun.commandBase = params.commandBase

	const project = (await import(absProjectFilePath)) as object

	for (const [k, v] of Object.entries(project)) {
		if (v instanceof neja.Build) {
			v.exportName ||= k
		}
	}

	const { ruleOut, buildOut, endOutput } = createOutputStreams({ buildDir })
	try {
		await writeHeaders({ ruleOut, buildOut, sourceDir: sourceDirPath, buildDir })

		await drainBuilds()

		await resolveRules({ ruleOut, buildOut, imports })
	} finally {
		endOutput()
	}
}

// NOTE: I wanted to use commander, but it is CommonJS and doesn't work well with esbuild+ESM. I'm
// not gonna waste time on making it work, so let's do a simple ad-hoc parser for now.
function parseArgs(): {
	commandBase: string
	file: string
	chdir?: string
} {
	const result: Partial<ReturnType<typeof parseArgs>> = {}

	const commandBase = `${process.argv[0]} ${process.argv[1]}`

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
		commandBase,
		...result,
	}
}
