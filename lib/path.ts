import * as path from "path"
import { path_isRoot } from "@util/node"
import type { FileItem, FileItemType } from "./file"
import { isFileItemType } from "./file"

export type Path = string & { readonly Path: unique symbol }

export type PathModifierFn = (resolvedPath: Path) => string
export type PathModifier = string | FileItem | PathModifierFn

export type resolvePath_UncheckedArgs = [seed: string | FileItem, ...modifiers: PathModifier[]]
export type resolvePath_CheckedArgs = [expectedType: FileItemType, ...resolvePath_UncheckedArgs]
export type resolvePath_Args = resolvePath_UncheckedArgs | resolvePath_CheckedArgs

/**
 * Universal function for joining and normalizing file paths.
 *
 * TODO: docs
 */
export function resolvePath(seed: string | FileItem, ...modifiers: PathModifier[]): Path

/**
 * Universal function for joining and normalizing file paths that also checks that the type of the
 * resolved path is as expected.
 */
export function resolvePath(
	expectedType: FileItemType,
	seed: string | FileItem,
	...modifiers: PathModifier[]
): Path

export function resolvePath(...args: resolvePath_Args): Path {
	return resolvePath_impl(args)
}

export function resolvePath_impl(args: resolvePath_Args): Path {
	let expectedType: FileItemType | null
	let seed: string | FileItem
	let modifiers: PathModifier[]
	if (isFileItemType(args[0])) {
		;[expectedType, seed, ...modifiers] = args as resolvePath_CheckedArgs
	} else {
		expectedType = null
		;[seed, ...modifiers] = args as resolvePath_UncheckedArgs
	}

	let paths: string[]
	if (typeof seed === "string") {
		if (!path.isAbsolute(seed)) {
			throw new Error(`Expected an absolute path, got: "${seed}"`)
		}
		paths = [resolvePath_flush(false, [seed])]
	} else {
		paths = [seed.absolutePath]
	}

	for (const modifier of modifiers) {
		if (typeof modifier === "function") {
			const flushed = resolvePath_flush(true, paths)
			const modified = modifier(flushed)
			const cleaned = resolvePath_flush(false, [modified])
			paths = [cleaned]
		} else {
			const extraPath = typeof modifier === "string" ? modifier : modifier.virtualPath
			const terminated = !isPathDirLike(paths[paths.length - 1])
			if (terminated) {
				const flushed = resolvePath_flush(true, paths)
				throw new Error(
					`Cannot append more segments to a path that has already been terminated by a file-like segment. Current path: "${flushed}", attempted to append: "${extraPath}"`,
				)
			}
			paths.push(extraPath)
		}
	}

	const resolvedPath = resolvePath_flush(true, paths)

	if (expectedType) {
		const actualType = pathType(resolvedPath)
		if (actualType !== expectedType) {
			throw new Error(
				`Expected a ${expectedType} path, but got a ${actualType} path: "${resolvedPath}"`,
			)
		}
	}

	return resolvedPath
}

function resolvePath_flush(firstClean: boolean, paths: string[]): Path {
	if (firstClean && paths.length === 1) {
		return paths[0] as Path
	}

	let resolvedPath = path.resolve(...paths)
	if (!path_isRoot(resolvedPath) && isPathDirLike(paths[paths.length - 1])) {
		resolvedPath += path.sep
	}
	return resolvedPath as Path
}

const SEP_DOT = `${path.sep}.`
const SEP_DOT_DOT = `${path.sep}..`

/**
 * Whether the given path (absolute or relative) is unambiguously pointing to a directory.
 *
 * TODO: doc
 */
export function isPathDirLike(p: string): boolean {
	return (
		p.endsWith("/") ||
		p.endsWith(path.sep) ||
		p.endsWith(SEP_DOT) ||
		p.endsWith(SEP_DOT_DOT) ||
		p === "." ||
		p === ".."
	)
}

export function pathType(p: Path): FileItemType {
	if (p.endsWith(path.sep)) {
		return "dir"
	} else {
		return "file"
	}
}

/**
 * Last portion of a path, assuming that it is in a resolved canonical form.
 *
 * This is slightly different from {@link path.basename} in that it includes the trailing slash,
 * essential for directories.
 *
 * If {@link p} is a root path, it is returned as is.
 */
export function pathBasename(p: Path): string {
	const i = p.lastIndexOf(path.sep, p.length - 2)
	if (i === -1) {
		return p
	} else {
		return p.slice(i + 1)
	}
}

/**
 * Path to parent, assuming the given path is in a resolved canonical form.
 *
 * This is slightly different from {@link path.dirname} in that it includes the trailing slash,
 * essential for directories.
 *
 * If {@link p} is a root path, returns `null`.
 */
export function parentPath(p: Path): Path | null {
	const i = p.lastIndexOf(path.sep, p.length - 2)
	if (i === -1) {
		return null
	} else {
		return p.slice(0, i + 1) as Path
	}
}

export function relativeDescendantPath(
	from: Path | FileItem,
	to: Path | FileItem,
	params: { includeSelf: boolean },
): string | null {
	const fromPath = typeof from === "string" ? from : from.absolutePath
	const toPath = typeof to === "string" ? to : to.absolutePath
	if (!toPath.startsWith(fromPath) || pathType(fromPath) !== "dir") {
		return null
	} else {
		const relativePath = toPath.slice(fromPath.length)
		if (relativePath) {
			return relativePath
		} else {
			if (params.includeSelf) {
				return "./"
			} else {
				return null
			}
		}
	}
}

export function expectRelativeDescendantPath(
	from: Path | FileItem,
	to: Path | FileItem,
	params: { includeSelf: boolean },
): string {
	const relativePath = relativeDescendantPath(from, to, params)
	if (!relativePath) {
		throw new Error(`Expected a descendant of "${from}", but got "${to}"`)
	}
	return relativePath
}

/**
 * Whether {@link descendant} is a descendant of {@link ancestor}.
 *
 * Always false if the {@link ancestor} is not a directory, even if `includeSelf` is true and the
 * two items are the same file.
 * 
 * @param includeSelf Whether to consider {@link ancestor} as its own descendant.
 */
export function isDescendant(from: Path | FileItem, to: Path | FileItem, params: { includeSelf: boolean }): boolean {
	return !!relativeDescendantPath(from, to, params)
}
