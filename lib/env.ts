import { Error_captureStructuredStackTrace } from "@util/node.ts"
import { File, Dir, dir, file, sourceRoot, outRoot } from "./file.ts"
import type { Path } from "./path.ts"
import { expectRelativeDescendantPath, isDescendant, resolvePath } from "./path.ts"

export const config = {
	sourceDirPath: null! as Path,
	buildDirPath: null! as Path,
	env: {} as Record<string, string>,
	flagBus: new Map<string, FlagExchange>(),
}

export function init(params: { sourceDirPath: string; buildDirPath: string }) {
	config.sourceDirPath = resolvePath(params.sourceDirPath)
	config.buildDirPath = resolvePath(params.buildDirPath)
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

	const absNejafilePath = filePathOrUrl.startsWith("file://")
		? filePathOrUrl.substring("file://".length)
		: filePathOrUrl

	const nejafile = file(absNejafilePath)

	if (!isDescendant(sourceRoot, nejafile, { includeSelf: false })) {
		return null
	}

	return nejafile
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

export function captureCurrentRelativeSourceDir(): string {
	const currentSourceDir = captureCurrentSourceDir()
	return expectRelativeDescendantPath(sourceRoot, currentSourceDir, {
		includeSelf: true,
	})
}

export function captureCurrentOutDir(): Dir {
	const currentRelativeSourceDir = captureCurrentRelativeSourceDir()
	return dir(outRoot, currentRelativeSourceDir)
}
