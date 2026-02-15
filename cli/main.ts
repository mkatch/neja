import * as fs from "fs"
import * as path from "path"
import { neja } from "@lib"
import { createOutputStreams, drainBuilds, resolveRules, writeHeaders } from "./gen.ts"
import { fs_symlink } from "@util/node.ts"
import { parseArgs } from "util"
// import { parseArgs } from "./args.ts"

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

	const nejafilePath = path.resolve(file)
	const sourceDirPath = path.dirname(nejafilePath)
	const relativeNejafilePath = path.basename(nejafilePath)

	const buildDirLinkPath = path.join(sourceDirPath, ".neja-build")

	const [nodeExePath, scriptPath] = await Promise.all([
		fs.promises.realpath(process.argv[0]),
		fs.promises.realpath(process.argv[1]),
	])

	if (chdir) {
		process.chdir(chdir)
	}
	const buildDir = process.cwd()

	await fs_symlink(buildDir, buildDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const nejaDirLinkPath = path.join(buildDir, "neja")
	const nejaDirPath = path.resolve(scriptPath, "../../")
	console.log(`Symlinking "${nejaDirPath}" to "${nejaDirLinkPath}"`)
	await fs_symlink(nejaDirPath, nejaDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	const nodeDirPath = path.resolve(nodeExePath, "../../")
	const nodeDirLinkPath = path.join(buildDir, "node")
	await fs_symlink(nodeDirPath, nodeDirLinkPath, {
		type: "dir",
		overrideIfExistsAsLink: true,
	})

	neja.config.sourceDir = sourceDirPath
	neja.config.buildDir = buildDir

	const nejafile = neja.sourceFile(relativeNejafilePath)
	neja.rerun.mainNejafile.onFileItem(nejafile)

	neja.rerun.commandBase = `${nodeExePath} ${scriptPath}`

	const project = (await import(nejafilePath)) as object

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
