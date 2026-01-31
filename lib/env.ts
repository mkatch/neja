import * as path from "path"
import { Error_captureStructuredStackTrace, path_nestedRelative } from "@util/node.ts"
import { buildCounterpart, Dir, dir, sourceDir } from "./file.ts"

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

const NEJA_FILE_PATH_PATTERN = /(^|[/.\\])neja\.[tj]s$/

export function captureAbsoluteCurrentNejaFilePath(): string {
	const stack = Error_captureStructuredStackTrace(captureAbsoluteCurrentNejaFilePath)

	let nejaFileUrl = ""
	for (const callSite of stack) {
		const fileUrl = callSite.getFileName()
		if (fileUrl && NEJA_FILE_PATH_PATTERN.test(fileUrl)) {
			nejaFileUrl = fileUrl
			break
		}
	}

	if (!nejaFileUrl) {
		throw new Error("Can't find a neja-file on the current stack trace.")
	}

	const absNejaFilePath = nejaFileUrl.startsWith("file://")
		? nejaFileUrl.substring("file://".length)
		: nejaFileUrl

	return absNejaFilePath
}

export function captureCurrentSourceDir(): Dir {
	const absNejaFilePath = captureAbsoluteCurrentNejaFilePath()

	const relNejaFilePath = path_nestedRelative(config.sourceDir, absNejaFilePath)
	if (!relNejaFilePath) {
		throw new Error(
			`Detected neja-file "${absNejaFilePath}" is outside the source directory of the active project: "${config.sourceDir}`,
		)
	}

	const relCurrentSourceDirPath = path.dirname(relNejaFilePath)
	const currentSourceDirPath = path.join(sourceDir.path, relCurrentSourceDirPath)
	const currentSourceDir = dir(currentSourceDirPath)

	return currentSourceDir
}

export function captureCurrentBuildDir(): Dir {
	const currentSourceDir = captureCurrentSourceDir()
	const currentBuildDirPath = buildCounterpart(currentSourceDir)
	const currentBuildDir = dir(currentBuildDirPath)
	return currentBuildDir
}
