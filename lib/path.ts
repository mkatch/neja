import * as nodePath from "path"
import type { FileItem, FileItemType } from "./file"
import { isFileItemType } from "./file"

/**
 * Absolute path to a file or a directory in a normalized canonical form, specific for the host
 * operating system.
 *
 * If the path includes a trailing slash, it is considered pointing to a directory, otherwise it
 * points to a file. The slash used in the canonical one for the host operating system, i.e.
 * back-slash (\\) on Windows and forward-slash (/) on POSIX.
 * 
 * Note that this is a simple string type and has no strict bearing on the actual file system. Just
 * because a {@link Path} object exists doesn't mean that the file or directory it points to
 * actually exists. And if the file or directory does exist, it doesn't necessarily mean that the
 * path correctly applies the trailing slash rule.
 */
export type Path = string & { readonly Path: unique symbol }

export type PathModifierFn = (path: Path) => string
export type PathModifier = string | FileItem | PathModifierFn

export type resolvePath_UncheckedArgs = [seed: Path | FileItem, ...modifiers: PathModifier[]]
export type resolvePath_CheckedArgs = [expectedType: FileItemType, ...resolvePath_UncheckedArgs]
export type resolvePath_Args = resolvePath_UncheckedArgs | resolvePath_CheckedArgs

export function pathOf(pathOrItem: Path | FileItem): Path {
	return typeof pathOrItem === "string" ? pathOrItem : pathOrItem.path
}

/**
 * Universal function for joining and normalizing file paths.
 *
 * TODO: docs
 */
export function resolvePath(seed: Path | FileItem, ...modifiers: PathModifier[]): Path

/**
 * Universal function for joining and normalizing file paths that also checks that the type of the
 * resolved path is as expected.
 */
export function resolvePath(
	expectedType: FileItemType,
	seed: Path | FileItem,
	...modifiers: PathModifier[]
): Path

export function resolvePath(...args: resolvePath_Args): Path {
	return resolvePath_impl(args)
}

export function resolvePath_impl(args: resolvePath_Args): Path {
	let expectedType: FileItemType | null
	let seed: Path | FileItem
	let modifiers: PathModifier[]
	if (isFileItemType(args[0])) {
		;[expectedType, seed, ...modifiers] = args as resolvePath_CheckedArgs
	} else {
		expectedType = null
		;[seed, ...modifiers] = args as resolvePath_UncheckedArgs
	}

	let parts: [Path, ...string[]] = [pathOf(seed)]

	for (const modifier of modifiers) {
		if (typeof modifier === "function") {
			const flushed = resolvePath_flush(parts)
			const modified = modifier(flushed)
			const normalized = normalizePath(modified)
			parts = [normalized]
		} else if (typeof modifier === "string") {
			parts.push(modifier)
		} else {
			parts.push(modifier.virtualPath)
		}
	}

	const path = resolvePath_flush(parts)

	if (expectedType) {
		const actualType = pathType(path)
		if (actualType !== expectedType) {
			throw new Error(`Expected a ${expectedType} path, but got a ${actualType} path: ${path}`)
		}
	}

	return path
}

function resolvePath_flush(paths: [Path, ...string[]]): Path {
	if (paths.length === 1) {
		return paths[0]
	}

	let path = nodePath.resolve(...paths)

	if (isPathDirLike(paths[paths.length - 1]) && nodePath.dirname(path) !== path) {
		path += nodePath.sep
	}

	return path as Path
}

export function normalizePath(type: FileItemType, absolutePath: string): Path

export function normalizePath(absolutePath: string): Path

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function normalizePath(arg0: string | FileItemType, arg1?: string): Path {
	let type: FileItemType | null
	let absolutePath: string
	if (isFileItemType(arg0)) {
		type = arg0
		absolutePath = arg1!
	} else {
		type = null
		absolutePath = arg0
	}

	if (!nodePath.isAbsolute(absolutePath)) {
		throw new Error(`Expected an absolute path, got: "${absolutePath}"`)
	}
	let normalizedPath = nodePath.normalize(absolutePath)

	if (type !== null) {
		const endsWithSep = normalizedPath.endsWith(nodePath.sep)
		if (type === "dir" && !endsWithSep) {
			normalizedPath += nodePath.sep
		} else if (type === "file" && endsWithSep) {
			throw new Error(`File paths must not end with a path separator. Got: "${absolutePath}"`)
		}
	}

	return normalizedPath as Path
}

const SEP_DOT = `${nodePath.sep}.`
const SEP_DOT_DOT = `${nodePath.sep}..`

/**
 * Whether the given path (absolute or relative) is unambiguously pointing to a directory.
 *
 * TODO: doc
 */
export function isPathDirLike(p: string): boolean {
	return (
		p.endsWith("/") ||
		p.endsWith(nodePath.sep) ||
		p.endsWith(SEP_DOT) ||
		p.endsWith(SEP_DOT_DOT) ||
		p === "." ||
		p === ".."
	)
}

export function pathType(p: Path): FileItemType {
	if (p.endsWith(nodePath.sep)) {
		return "dir"
	} else {
		return "file"
	}
}

/**
 * Last portion of a path, assuming that it is in a resolved canonical form.
 *
 * This is slightly different from {@link nodePath.basename} in that it includes the trailing slash,
 * essential for directories.
 *
 * If {@link p} is a root path, it is returned as is.
 */
export function pathBasename(p: Path): string {
	const i = p.lastIndexOf(nodePath.sep, p.length - 2)
	if (i === -1) {
		return p
	} else {
		return p.slice(i + 1)
	}
}

export function parentPath(path: Path): Path {
	const i = path.lastIndexOf(nodePath.sep, path.length - 2)
	if (i === -1) {
		return path
	} else {
		return path.slice(0, i + 1) as Path
	}
}

export function relativeDescendantPath(
	from: Path | FileItem,
	to: Path | FileItem,
	params: { includeSelf: boolean },
): string | null {
	const fromPath = pathOf(from)
	const toPath = pathOf(to)
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
export function isDescendant(
	from: Path | FileItem,
	to: Path | FileItem,
	params: { includeSelf: boolean },
): boolean {
	return !!relativeDescendantPath(from, to, params)
}
