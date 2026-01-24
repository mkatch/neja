import * as path from "path"
import { program } from "commander"
import Module, { createRequire } from "module"
import { drainBuilds } from "./gen.ts"
import { Build } from "../def/build.ts"

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

	const require = createRequire(import.meta.url)
	const project = require(projectFile) as Module

	for (const [k, v] of Object.entries(project)) {
		if (v instanceof Build) {
			v.exportName ||= k
		}
	}

	await drainBuilds({ sourceDir, buildDir })
}
