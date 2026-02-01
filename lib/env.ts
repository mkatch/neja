import { Error_captureStructuredStackTrace, path_nestedRelative } from "@util/node.ts"
import { buildCounterpart, File, Dir, dir, sourceFile } from "./file.ts"

export const config = {
	sourceDir: "",
	buildDir: "",
	env: {} as Record<string, string>,
	flagBus: new Map<string, FlagExchange>(),
}

type FlagExchange =
	| { stage: "requested" }
	| { stage: "provided"; value: unknown }
	| { stage: "consumed" }

const NEJAFILE_PATH_PATTERN = /(^|[/.\\])neja\.[tj]s$/

export function maybeNejafile(filePathOrUrl: string): File | null {
	if (!NEJAFILE_PATH_PATTERN.test(filePathOrUrl)) {
		return null
	}

	const absNejaFilePath = filePathOrUrl.startsWith("file://")
		? filePathOrUrl.substring("file://".length)
		: filePathOrUrl

	const relNejaFilePath = path_nestedRelative(config.sourceDir, absNejaFilePath)
	if (!relNejaFilePath) {
		return null
	}

	return sourceFile(relNejaFilePath)
}

export function captureCurrentNejafile(): File {
	const stack = Error_captureStructuredStackTrace(captureCurrentNejafile)

	for (const callSite of stack) {
		const fileUrl = callSite.getFileName()
		const nejafile = fileUrl && maybeNejafile(fileUrl)
		if (nejafile) {
			return nejafile
		}
	}

	throw new Error("Can't find a Nejafile on the current stack trace.")
}

export function captureCurrentSourceDir(): Dir {
	const nejafile = captureCurrentNejafile()
	return nejafile.parent
}

export function captureCurrentBuildDir(): Dir {
	const currentSourceDir = captureCurrentSourceDir()
	const currentBuildDirPath = buildCounterpart(currentSourceDir)
	const currentBuildDir = dir(currentBuildDirPath)
	return currentBuildDir
}
