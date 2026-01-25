import * as path from "path"
import { program } from "commander"
import { drainBuilds } from "./gen.ts"
import { Build } from "../def/build.ts"
import { config } from "../def/config.ts"

program
	.name("neja") //
	.option("-f, --file <file>", "specify input neja file", "neja.ts")
	.option("-C, --chdir <dir>", "change to directory before doing anything else")
	.action(main)
	.parse()

async function main(params: { file: string; chdir?: string }) {
	const projectFile = path.resolve(params.file)
	const sourceDir = path.dirname(projectFile)

	if (params.chdir) {
		process.chdir(params.chdir)
	}
	const buildDir = process.cwd()

	config.sourceDir = sourceDir
	config.buildDir = buildDir

	const project = (await import(projectFile)) as object

	for (const [k, v] of Object.entries(project)) {
		if (v instanceof Build) {
			v.exportName ||= k
		}
	}

	await drainBuilds({ sourceDir, buildDir })
}
