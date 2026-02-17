import * as fs from "fs"
import * as nodePath from "path"
import { neja } from "@lib"
import { createOutputStreams, drainBuilds, resolveRules, writeHeaders } from "./gen.ts"
import { fs_symlink } from "@util/node.ts"
import { parseArgs } from "util"

export default async function main(imports: string[]): Promise<void> {
	const {
		values: { file, chdir },
	} = parseArgs({
		options: {
			file: { type: "string", short: "f" },
			chdir: { type: "string", short: "C" },
		},
	})

	if (!file) {
		throw new Error("Must provide path to Nejafile")
	}

	const [nodeExePath, scriptPath] = await Promise.all([
		fs.promises.realpath(process.argv[0]).then((path) => neja.normalizePath("file", path)),
		fs.promises.realpath(process.argv[1]).then((path) => neja.normalizePath("file", path)),
	])
	const nejafilePath = neja.normalizePath("file", nodePath.resolve(file))

	if (chdir) {
		process.chdir(chdir)
	}
	const buildDirPath = neja.normalizePath("dir", process.cwd())
	const sourceDirPath = neja.parentPath(nejafilePath)

	neja.internal.env_init({
		sourceDirPath,
		buildDirPath,
	})
	neja.internal.file_init()

	const buildDirLinkPath = neja.resolvePath(sourceDirPath, ".neja-build/")
	await fs_symlink(buildDirPath, buildDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const nejaDirLinkPath = neja.resolvePath(buildDirPath, "neja/")
	const nejaDirPath = neja.resolvePath(scriptPath, "../../")
	console.log(`Symlinking "${nejaDirPath}" to "${nejaDirLinkPath}"`)
	await fs_symlink(nejaDirPath, nejaDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const nodeDirPath = neja.resolvePath(nodeExePath, "../../")
	const nodeDirLinkPath = neja.resolvePath(buildDirPath, "node/")
	await fs_symlink(nodeDirPath, nodeDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const ruleFile = neja.pipe(neja.internal.buildFileItem("file", "rules.ninja"), neja.rerun.outs)
	const buildFile = neja.pipe(neja.internal.buildFileItem("file", "build.ninja"), neja.rerun.outs)
	neja.pipe(neja.file(nejafilePath), neja.rerun.mainNejafile)
	neja.rerun.commandBase = `${nodeExePath} ${scriptPath}`

	const project = (await import(nejafilePath)) as object

	for (const [k, v] of Object.entries(project)) {
		if (v instanceof neja.Build) {
			v.exportName ||= k
		}
	}

	const { ruleOut, buildOut, endOutput } = createOutputStreams({ ruleFile, buildFile })
	try {
		await writeHeaders({ ruleOut, buildOut })

		await drainBuilds()

		await resolveRules({ ruleOut, buildOut, imports })
	} finally {
		endOutput()
	}
}
