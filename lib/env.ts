import { Error_captureStructuredStackTrace } from "@util/node.ts"
import { File, Dir, dir, file, sourceRoot, outRoot } from "./file.ts"
import type { Path } from "./path.ts"
import { expectRelativeDescendantPath, isDescendant, normalizePath } from "./path.ts"

export let sourceDirPath!: Path
export let buildDirPath!: Path

export function env_init(params: { sourceDirPath: Path; buildDirPath: Path }): void {
	sourceDirPath = params.sourceDirPath
	buildDirPath = params.buildDirPath
}

const NEJAFILE_PATH_PATTERN = /(^|[/.\\])neja\.[tj]s$/

export function isNejafilePath(filePathOrUrl: string): boolean {
	return NEJAFILE_PATH_PATTERN.test(filePathOrUrl)
}

export function maybeNejafile(filePathOrUrl: string): File | null {
	if (!isNejafilePath(filePathOrUrl)) {
		return null
	}

	const nejafilePath = normalizePath(
		filePathOrUrl.startsWith("file://") ? filePathOrUrl.substring("file://".length) : filePathOrUrl,
	)

	if (!isDescendant(sourceRoot, nejafilePath, { includeSelf: false })) {
		return null
	}

	return file(nejafilePath)
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
