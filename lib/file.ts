import * as path from "path"
import { addDiscoveryTask } from "./scheduling.ts"
import { captureCurrentOutDir, captureCurrentSourceDir, config } from "./env.ts"
import { isPromiseLike } from "@util/async.ts"
import { pipe, type FilePipeLike } from "./pipe.ts"
import {
	expectRelativeDescendantPath,
	parentPath,
	pathBasename,
	pathType,
	resolvePath,
	resolvePath_impl,
	type Path,
	type PathModifier,
	type resolvePath_Args,
} from "./path.ts"

const allFileItems = new Map<Path, FileItem>()

interface FileItem_Base {
	/** Base name of the file item. Includes the trailing slash for directories. */
	name: string

	/**
	 * Absolute path normalized for the host operating system.
	 *
	 * Always includes a trailing slash for the directories (and no slash for other files). The slash
	 * used in the canonical one for the host operating system, i.e. back-slash (\\) on Windows and
	 * forward-slash (/) on POSIX.
	 */
	absolutePath: Path

	/** Parent {@link VirtualRootDir}. */
	virtualRoot: VirtualRootDir

	/** Path relative to the virtual root directory. */
	virtualPath: string

	/** A promise accumulating any incomplete async operations still operating on this item. */
	pendingTasks: Promise<void> | null

	toString(): string
}

/** A {@link FileItem} representing a regular file. */
export interface File extends FileItem_Base {
	type: "file"

	/** Parent directory. */
	parent: Dir
}

/** A {@link FileItem} representing a directory. */
export interface Dir extends FileItem_Base {
	type: "dir"

	/**
	 * Parent directory, or null if this is a root directory, e.g. "/" on POSIX and "C:\\" on Windows.
	 */
	parent: Dir | null

	/** Child files and directories declared so far. */
	children: FileItem[]
}

/**
 * Special directory designated as a virtual root for the project.
 *
 * Virtual roots are mostly ordinary directories, but they have been singled out because it is
 * convenient to refer to some other files and directories as relative to a common root. For example
 * you might want to refer to your source files as relative to the root directory of your project,
 * and the output files as relative to the output directory. For a given source file, you might want
 * to get a path to a file that has an identical relative path, but resides in the output directory,
 * and so on.
 *
 * Some virtual-roots are pre-defined:
 *  - The source directory, which is the root of your project's source files: {@link sourceRoot}.
 *  - The build directory, which is directory in which neja keeps all the build files:
 * 		{@link buildRoot}.
 *  - The `out/` subdirectory of the build directory, intended as the output location for all build
 *    products: {@link outRoot}.
 *  - The `bin/` subdirectory, is a standard place for your executables (or links to them).
 *  - Any true system root directories, e.g. "/" on POSIX and "C:\\" on Windows, are implicitly
 * 		virtual roots.
 *
 * You can also define your own at any custom path for convenience using the {@link virtualRoot}
 * function. It is allowed to declare virtual roots nested inside other virtual roots.
 *
 * There is a nuance involving the "build" directory ({@link buildRoot}) and the "output" directory
 * ({@link outRoot}). The build directory is strictly reserved for the internal use of Neja and you
 * are not allowed to place any build products there. You should use the output directory for that
 * purpose which is entirely at your disposal.
 *
 * This unravels an additional function of the virtual roots: they protect the build directory from
 * writing while still allowing some flexibility. You can't write in the build directory directly,
 * but you _can_ declare a virtual root there without restriction and inside it you can do whatever
 * you want.
 *
 * For simple projects, the pre-defined output directory is probably sufficient, but for
 * more advanced scenarios, you might want to have additional virtual roots for things like
 * generated files,
 *
 * Every file or directory has exactly one virtual root assigned at declaration
 * {@link FileItem.virtualRoot} (this implies that the virtual roots must be declared up-front
 * before their descendants). A virtual root is its own virtual root.
 */
export interface VirtualRootDir extends Dir {
	ninjaPath: string
}

/** A file system item, which may be a file or a directory. */
export type FileItem = File | Dir | VirtualRootDir

/** Tag of the {@link FileItem} union. */
export type FileItemType = FileItem["type"]

export type FileItemTypeMap = {
	file: File
	dir: Dir
}

export type FileItemOfType<T extends FileItemType> = FileItemTypeMap[T]

function File_create(parent: Dir, absolutePath: Path): File {
	return FileItem_register<File>({
		type: "file",
		name: FileItem_makeName(absolutePath),
		parent,
		absolutePath,
		virtualPath: FileItem_makeVirtualPath(parent.virtualRoot, absolutePath),
		virtualRoot: parent.virtualRoot,
		pendingTasks: null,
		toString: FileItem_toString,
	})
}

function Dir_create(parent: Dir, absolutePath: Path): Dir {
	return FileItem_register<Dir>({
		type: "dir",
		name: FileItem_makeName(absolutePath),
		parent,
		children: [],
		absolutePath,
		virtualPath: FileItem_makeVirtualPath(parent.virtualRoot, absolutePath),
		virtualRoot: parent.virtualRoot,
		pendingTasks: null,
		toString: FileItem_toString,
	})
}

function VirtualRootDir_create(
	parent: Dir | null,
	absolutePath: Path,
	ninjaPath: string,
): VirtualRootDir {
	const item: VirtualRootDir = {
		type: "dir",
		name: FileItem_makeName(absolutePath),
		parent,
		children: [],
		virtualRoot: null!,
		ninjaPath,
		absolutePath,
		virtualPath: "./",
		pendingTasks: null,
		toString: FileItem_toString,
	}
	item.virtualRoot = item
	return FileItem_register(item)
}

function FileItem_makeName(absolutePath: Path): string {
	return pathBasename(absolutePath)
}

function FileItem_makeVirtualPath(virtualRoot: VirtualRootDir, absolutePath: Path): string {
	return expectRelativeDescendantPath(virtualRoot, absolutePath, { includeSelf: false })
}

function FileItem_toString(this: FileItem): string {
	if (this.virtualRoot.ninjaPath) {
		return path.join(this.virtualRoot.ninjaPath, this.virtualPath)
	} else if (this.virtualRoot.parent) {
		return path.join(this.virtualRoot.parent.toString(), this.virtualRoot.name, this.virtualPath)
	} else {
		return this.absolutePath
	}
}

function FileItem_register<T extends FileItem>(item: T): T {
	if (allFileItems.has(item.absolutePath)) {
		throw new Error(`File item already registered: ${item.absolutePath}`)
	}

	const inferredType = pathType(item.absolutePath)
	if (item.type !== inferredType) {
		throw new Error(
			`Internal error: path refers to a ${inferredType}, but item is declared as ${item.type}: "${item.absolutePath}"`,
		)
	}

	allFileItems.set(item.absolutePath, item)
	item.parent?.children.push(item)
	return item
}

export function FileItem_addTask(
	item: FileItem,
	task: (item: FileItem) => void | Promise<void>,
): void {
	let thisTask: Promise<void> | null = null
	if (item.pendingTasks) {
		thisTask = item.pendingTasks = item.pendingTasks.then(() => task(item))
	} else {
		const result = task(item)
		if (isPromiseLike(result)) {
			thisTask = item.pendingTasks = result
		}
	}

	if (thisTask) {
		addDiscoveryTask(thisTask)
		void thisTask.then(() => {
			if (item.pendingTasks === thisTask) {
				item.pendingTasks = null
			}
		})
	}
}

function VirtualRootDir_createPrimary(absolutePath: Path, ninjaPath: string): VirtualRootDir {
	const absoluteParentPath = parentPath(absolutePath)
	const parent = absoluteParentPath ? dir(absoluteParentPath) : null
	return VirtualRootDir_create(parent, absolutePath, ninjaPath)
}

function FileItem_assertType<T extends FileItemType>(
	item: FileItem,
	expectedType: T,
): asserts item is FileItemOfType<T> {
	if (item.type !== expectedType) {
		throw new Error(`Expected a ${expectedType}, but got a ${item.type}: "${item.absolutePath}"`)
	}
}

/** Whether the given object is a {@link FileItemType}. */
export function isFileItemType(obj: unknown): obj is FileItemType {
	return obj === "file" || obj === "dir"
}

// Delicate case! In order for this to work correctly, the source dir must not be nested in the
// build dir (the other way around is fine and expected). This is checked during initialization.
/**
 * A {@link VirtualRootDir} representing the source directory of the project.
 */
export const sourceRoot = VirtualRootDir_createPrimary(config.sourceDirPath, "sourcedir")

/**
 * A {@link VirtualRootDir} representing the current build directory managed by Neja.
 *
 * You should not write your own files here; use {@link outRoot} for that or declare a custom
 * virtual root. See {@link VirtualRootDir} for details.
 */
export const buildRoot = VirtualRootDir_createPrimary(config.buildDirPath, "builddir")

/**
 * Declare a custom {@link VirtualRootDir} at an arbitrary path.
 *
 * Path resolved according to the rules of {@link resolvePath}. Must be declared up-front before
 * any of its descendants.
 */
export function virtualRoot(seed: string | Dir, ...modifiers: PathModifier[]): VirtualRootDir {
	const absolutePath = resolvePath("dir", seed, ...modifiers)

	const existing = allFileItems.get(absolutePath)
	if (existing) {
		if (existing.virtualRoot === existing) {
			return existing.virtualRoot
		} else {
			throw new Error(
				`Virtual roots should be declared up-front. Cannot declare a virtual root at a path that has already been declared as an ordinary directory: "${absolutePath}"`,
			)
		}
	}

	const absoluteParentPath = parentPath(absolutePath)

	if (!absoluteParentPath) {
		return VirtualRootDir_create(null, absolutePath, "")
	}

	const parent = Dir_declareRecursively(absoluteParentPath, {
		originalPath: absolutePath,
		allowBuildRoot: true,
	})

	return VirtualRootDir_create(parent, absolutePath, "")
}

/**
 * A {@link VirtualRootDir} intended as the output directory for your build products. Point to the
 * `out/` subdirectory of the build directory.
 *
 * Entirely at your disposal, unlike the {@link buildRoot} which is reserved for Neja's internal
 * use. See {@link VirtualRootDir} for details.
 */
export const outRoot = virtualRoot(buildRoot, "out/")

/**
 * A {@link VirtualRootDir} intended as the directory for your executable binaries, scripts, or
 * links to those. Points to the `bin/` subdirectory of the build directory.
 *
 * Provides easy access to your project's tools. You can make it extra convenient if you add
 * `.neja-build/bin/` to your `PATH` environment variable.
 */
export const binRoot = virtualRoot(buildRoot, "bin/")

export function queryFileItem<T extends FileItemType>(
	type: T,
	seed: string | FileItem,
	...modifiers: PathModifier[]
): FileItemOfType<T> | null

export function queryFileItem(
	seed: string | FileItem,
	...modifiers: PathModifier[]
): FileItem | null

export function queryFileItem(...args: resolvePath_Args): FileItem | null {
	const resolvedPath = resolvePath_impl(args)
	return allFileItems.get(resolvedPath) ?? null
}

export function queryDir(...args: Parameters<typeof resolvePath>): Dir | null {
	return queryFileItem("dir", ...args)
}

export function queryFile(...args: Parameters<typeof resolvePath>): File | null {
	return queryFileItem("file", ...args)
}

export function fileItem<T extends FileItemType>(
	type: T,
	seed: string | FileItem,
	...modifiers: PathModifier[]
): FileItemOfType<T>

export function fileItem(seed: string | FileItem, ...modifiers: PathModifier[]): FileItem

export function fileItem(...args: resolvePath_Args): FileItem {
	return fileItem_impl(args, { allowBuildRoot: false })
}

export function fileItem_impl(resolvePathArgs: resolvePath_Args, params: { 
	allowBuildRoot: boolean
}): FileItem {
	const { allowBuildRoot } = params

	const absolutePath = resolvePath_impl(resolvePathArgs)

	const existing = allFileItems.get(absolutePath)
	if (existing) {
		return existing
	}

	const absoluteParentPath = parentPath(absolutePath)
	const parent = Dir_declareRecursively(absoluteParentPath ?? absolutePath, {
		originalPath: absolutePath,
		allowBuildRoot,
	})

	if (absoluteParentPath === null) {
		return parent
	}

	const type = pathType(absolutePath)
	switch (type) {
		case "file":
			return File_create(parent, absolutePath)
		case "dir":
			return Dir_create(parent, absolutePath)
	}
}

export function file(seed: string | FileItem, ...modifiers: PathModifier[]): File {
	return fileItem("file", seed, ...modifiers)
}

export function dir(seed: string | FileItem, ...modifiers: PathModifier[]): Dir {
	return fileItem("dir", seed, ...modifiers)
}

export function buildFileItem<T extends FileItemType>(type: T, ...modifiers: PathModifier[]): FileItemOfType<T> {
	return fileItem_impl([type, buildRoot, ...modifiers], {
		allowBuildRoot: true,
	}) as FileItemOfType<T>
}

function Dir_declareRecursively(
	currentPath: Path,
	config: {
		originalPath: Path
		allowBuildRoot: boolean
	},
): Dir {
	const existing = allFileItems.get(currentPath)
	if (existing) {
		if (existing === buildRoot && !config.allowBuildRoot) {
			throw new Error(
				`Cannot declare a path in the build directory outside of a pre-defined virtual root: "${config.originalPath}"`,
			)
		}
		FileItem_assertType(existing, "dir")
		return existing
	}

	const absoluteParentPath = parentPath(currentPath)

	if (!absoluteParentPath) {
		return VirtualRootDir_create(null, currentPath, "")
	}

	const parent = Dir_declareRecursively(absoluteParentPath, config)

	return Dir_create(parent, currentPath)
}

type FileTreeDeclValue = FileTreeDecl | FilePipeLike

type FileTreeDecl = {
	[key in string]: FileTreeDeclValue
}

export function fileTree(rootedAt: Dir, tree: FileTreeDecl): Dir {
	for (const [key, value] of Object.entries(tree)) {
		const child = fileItem(rootedAt, key)
		if (FileTreeDeclValue_isPipe(value)) {
			pipe(child, value)
		} else if (child.type === "dir") {
			fileTree(child, value)
		} else {
			throw new Error(
				`Path resolves to a file, but treated as a directory: "${child.absolutePath}"`,
			)
		}
	}
	return rootedAt
}

function FileTreeDeclValue_isPipe(value: FileTreeDeclValue): value is FilePipeLike {
	return (
		typeof value === "function" || Array.isArray(value) || typeof value.onFileItem === "function"
	)
}

export function fileTree_checkCurrentSourceDirIsSourceRoot(params: {
	caller: Function
	preferred: Function
}): void {
	const currentSourceDir = captureCurrentSourceDir()
	if (currentSourceDir !== sourceRoot) {
		throw new Error(
			`You should only call ${params.caller.name}() from the root directory of your project. If you use imported directories, use ${params.preferred.name}() or fileTree() to avoid ambiguity. Current directory: "${currentSourceDir.absolutePath}, source root directory: "${sourceRoot.absolutePath}"`,
		)
	}
}

export function sourceTree(tree: FileTreeDecl): Dir {
	fileTree_checkCurrentSourceDirIsSourceRoot({
		caller: sourceTree,
		preferred: currentSourceTree,
	})
	return fileTree(sourceRoot, tree)
}

export function currentSourceTree(tree: FileTreeDecl): Dir {
	return fileTree(captureCurrentSourceDir(), tree)
}

export function outTree(tree: FileTreeDecl): Dir {
	fileTree_checkCurrentSourceDirIsSourceRoot({
		caller: outTree,
		preferred: currentOutTree,
	})
	return fileTree(outRoot, tree)
}

export function currentOutTree(tree: FileTreeDecl): Dir {
	return fileTree(captureCurrentOutDir(), tree)
}

/**
 * Collect {@link FileItem.pendingTasks} from a {@link FileItem} and/or its descendants into one
 * promise.
 *
 * @param includeSelf Whether to include the pending tasks of the item itself, or just the strict descendants. Defaults to `true`.
 */
export function allPendingTasks(
	item: FileItem,
	params?: { includeSelf?: boolean },
): void | Promise<void> {
	const { includeSelf = true } = params ?? {}

	const pendingTasks = new Array<Promise<void>>()
	for (const descendant of allDescendants(item, { includeSelf })) {
		if (descendant.pendingTasks) {
			pendingTasks.push(descendant.pendingTasks)
		}
	}
	if (pendingTasks.length === 0) {
		return
	} else {
		return Promise.all(pendingTasks).then(() => {})
	}
}

/**
 * Iterate over all descendants of a {@link FileItem}.
 *
 * @param includeSelf Whether to include the item itself, or just the strict descendants.
 */
export function allDescendants(
	item: FileItem,
	params: { includeSelf: boolean },
): Iterable<FileItem> {
	return params.includeSelf ? allDescendants_inclusive(item) : allDescendants_exclusive(item)
}

function* allDescendants_inclusive(item: FileItem): Iterable<FileItem> {
	yield item
	yield* allDescendants_exclusive(item)
}

function* allDescendants_exclusive(item: FileItem): Iterable<FileItem> {
	if (item.type === "dir") {
		for (const child of item.children) {
			yield* allDescendants_inclusive(child)
		}
	}
}
