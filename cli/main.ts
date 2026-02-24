import * as fs from "fs"
import * as nodePath from "path"
import { neja } from "@lib"
import { executeRuleEffects, processImports, resolveRules, writeNinjaFile } from "./gen.ts"
import { fs_symlink, process_chdir } from "@util/node.ts"
import { parseArgs } from "util"

export default async function main(imports: string[]): Promise<void> {
	let cliArgv = process.argv.slice(2)
	let nejaArgv: string[] = []
	const optionTerminatorIndex = cliArgv.indexOf("--")
	if (optionTerminatorIndex !== -1) {
		nejaArgv = cliArgv.slice(optionTerminatorIndex + 1)
		cliArgv = cliArgv.slice(0, optionTerminatorIndex)
	}
	console.log("CLI argv:", cliArgv)
	console.log("Neja argv:", nejaArgv)

	const {
		values: { file, chdir, makeChdir = false },
	} = parseArgs({
		args: cliArgv,
		options: {
			file: { type: "string", short: "f" },
			chdir: { type: "string", short: "C" },
			makeChdir: { type: "boolean", short: "m" },
		},
	})

	if (!file) {
		throw new Error("Must provide path to Nejafile")
	}

	const nejafilePath = neja.normalizePath("file", nodePath.resolve(file))
	if (!neja.isNejafilePath(nejafilePath)) {
		throw new Error(
			`File name not recognized as a Nejafile: ${nejafilePath}. Allowed files are: neja.ts, neja.js, *.neja.ts, *.neja.js.`,
		)
	}

	const [nodeExePath, scriptPath] = await Promise.all([
		fs.promises.realpath(process.argv[0]).then((path) => neja.normalizePath("file", path)),
		fs.promises.realpath(process.argv[1]).then((path) => neja.normalizePath("file", path)),
	])

	if (chdir) {
		await process_chdir(chdir, { createRecursively: makeChdir })
	}
	const buildDirPath = neja.normalizePath("dir", process.cwd())
	const sourceDirPath = neja.parentPath(nejafilePath)

	neja.internal.env_init({
		sourceDirPath,
		buildDirPath,
	})
	neja.internal.arg_init({ argv: nejaArgv })
	neja.internal.file_init()

	const buildDirLinkPath = neja.resolvePath(sourceDirPath, ".neja-build/")
	await fs_symlink(buildDirPath, buildDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const nejaDirLinkPath = neja.resolvePath(buildDirPath, "neja/")
	const nejaDirPath = neja.resolvePath(scriptPath, "../../")
	console.log(`Symlinking "${nejaDirLinkPath}" to "${nejaDirPath}"`)
	await fs_symlink(nejaDirPath, nejaDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const nodeDirPath = neja.resolvePath(nodeExePath, "../../")
	const nodeDirLinkPath = neja.resolvePath(buildDirPath, "node/")
	console.log(`Symlinking "${nodeDirLinkPath}" to "${nodeDirPath}"`)
	await fs_symlink(nodeDirPath, nodeDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const ninjaFile = neja.pipe(neja.internal.buildFileItem("file", "build.ninja"), neja.rerun.outs)
	neja.pipe(neja.file(nejafilePath), neja.rerun.mainNejafile)
	neja.rerun.commandBase = `${nodeExePath} ${scriptPath}`

	await import(nejafilePath)

	await processImports(imports)
	await executeRuleEffects()
	resolveRules()
	await writeNinjaFile(ninjaFile)
}
