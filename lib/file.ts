import * as nodePath from "path"
import { isPromiseLike } from "@util/async.ts"
import { addDiscoveryTask } from "./scheduling.ts"
import {
	buildDirPath,
	captureCurrentOutDir,
	captureCurrentSourceDir,
	sourceDirPath,
} from "./env.ts"
import type { FilePipeLike } from "./pipe.ts"
import { pipe } from "./pipe.ts"
import type { Path, PathModifier, resolvePath_Args } from "./path.ts"
import {
	expectRelativeDescendantPath,
	parentPath,
	pathBasename,
	pathType,
	resolvePath_impl,
} from "./path.ts"
import { RuleVar } from "./build.ts"
import { virtualRoot } from "./pipes/virtual_root.ts"
import { ninjaVar } from "./pipes/ninja_var.ts"

const allFileItems = new Map<Path, FileItem>()

/** The virtual root representing the source directory of the project. */
export let sourceRoot!: Dir

/**
 * The virtual root representing the current build directory managed by Neja.
 *
 * This directory is reserved for internal use of Neja and you should not write your own files here;
 * use other dedicated directories like {@link outRoot} or {@link binRoot}.
 */
export let buildRoot!: Dir

/**
 * The virtual root representing the `out/` subdirectory of {@link buildRoot}, intended for your
 * build outputs.
 *
 * Entirely at your disposal, unlike the {@link buildRoot} which is reserved for Neja's internal
 * use.
 */
export let outRoot!: Dir

/**
 * The virtual root representing the `bin/` subdirectory of {@link buildRoot}, intended as a handy
 * place for your executables and scripts (or links to those).
 *
 * Provides easy access to your project's tools. You can make it extra convenient if you add
 * `.neja-build/bin/` to your `PATH` environment variable.
 */
export let binRoot!: Dir

export function file_init() {
	// Delicate case! In order for this to work correctly, the source dir must not be nested in the
	// build dir (the other way around is fine and expected). This is checked during initialization.
	sourceRoot = pipe(dir(sourceDirPath), [virtualRoot, ninjaVar("sourcedir")])
	buildRoot = pipe(dir(buildDirPath), [virtualRoot, ninjaVar("builddir")])
	outRoot = pipe(buildFileItem("dir", "out/"), virtualRoot)
	binRoot = pipe(buildFileItem("dir", "bin/"), virtualRoot)
}

interface FileItem_Base {
	/** Base name of the file item. Includes the trailing slash for directories. */
	name: string

	/** Absolute normalized path to this file or directory. */
	path: Path

	/**
	 * Special parent directory designated as a virtual root for this item.
	 *
	 * Virtual roots are mostly ordinary directories, but they have been singled out because it is
	 * convenient to refer to some other files and directories as relative to a common root. For
	 * example you might want to refer to your source files as relative to the root directory of your
	 * project, and the output files as relative to the output directory. For a given source file, you
	 * might want to get a path to a file that has an identical relative path, but resides in the
	 * output directory, and so on.
	 *
	 * Some virtual-roots are pre-defined:
	 *  - The source directory {@link sourceRoot}, which is the root of your project's source files.
	 *  - The build directory {@link buildRoot}, in which Neja keeps all its files. This directory is
	 *    reserved and you are not allowed to declare any files or directories in it outside of the
	 *    pre-defined sub-directories.
	 *  - The `out/` subdirectory {@link outRoot}.of the build directory, intended as the output
	 *    location for all build products.
	 *  - The `bin/` subdirectory {@link binRoot}, is a standard place for your executables (or links
	 *    to them).
	 *  - Any actual system root directories, e.g. "/" on POSIX and "C:\\" on Windows, are implicitly
	 *    virtual roots.
	 *
	 * For simple projects this should be sufficient, but if you want more control, you can promote
	 * any directory to be a virtual root using the {@link virtualRoot} pipe. Example usages include:
	 * generated file directory, sub-packages, intermediate build products, etc.
	 *
	 * Every file or directory has exactly one virtual root {@link FileItem.virtualRoot} assigned at
	 * declaration and it cannot be changed (this implies that the virtual roots must be declared
	 * up-front before their descendants). A virtual root is its own virtual root.
	 *
	 * TODO: refine these docs
	 */
	virtualRoot: Dir

	/** Path relative to the virtual root directory. */
	virtualPath: string

	/**
	 * Parent directory.
	 *
	 * If this item is a root directory, e.g. "/" on POSIX or "C:\\" on Windows, it is its own parent.
	 */
	parent: Dir

	/** A promise accumulating any incomplete async operations still scheduled for this item. */
	pendingTasks: Promise<void> | null

	ninjaVar: RuleVar | null

	toString(): string
}

/** A {@link FileItem} representing a regular file. */
export interface File extends FileItem_Base {
	type: "file"
}

/** A {@link FileItem} representing a directory. */
export interface Dir extends FileItem_Base {
	type: "dir"

	/** Child files and directories declared so far. */
	children: FileItem[]
}

/** A file system item, which may be a file or a directory. */
export type FileItem = File | Dir

/** Tag of the {@link FileItem} union. */
export type FileItemType = FileItem["type"]

/** Map of {@link FileItem} union members by tag. */
export type FileItemTypeMap = {
	file: File
	dir: Dir
}

/** Extract member of the {@link FileItem} union by tag. */
export type FileItemOfType<T extends FileItemType> = FileItemTypeMap[T]

function FileItem_create(parent: Dir | null, path: Path): FileItem {
	if (allFileItems.has(path)) {
		throw new Error(`File item already registered: ${path}`)
	}

	const type = pathType(path)

	const base: FileItem_Base = {
		name: pathBasename(path),
		path,
		pendingTasks: null,
		ninjaVar: null,
		toString: FileItem_toString,

		// Potentially self-referential, assigned later.
		parent: null!,
		virtualRoot: null!,
		virtualPath: null!,
	}

	const item: FileItem =
		type === "file" ? Object.assign(base, { type }) : Object.assign(base, { type, children: [] })

	if (parent) {
		item.parent = parent
		item.virtualRoot = parent.virtualRoot
		item.virtualPath = expectRelativeDescendantPath(parent.virtualRoot, path, {
			includeSelf: false,
		})
		parent.children.push(item)
	} else {
		FileItem_assertType(item, "dir")
		item.parent = item
		Dir_promoteToVirtualRoot(item)
	}

	allFileItems.set(path, item)

	return item
}

export function Dir_promoteToVirtualRoot(dir: Dir): void {
	if (dir.children.length > 0) {
		throw new Error(
			`Virtual roots should be declared up-front. Cannot declare a virtual root at a path that already has children : ${dir}`,
		)
	}
	dir.virtualRoot = dir
	dir.virtualPath = "./"
}

function FileItem_toString(this: FileItem): string {
	if (this.ninjaVar) {
		return this.ninjaVar.toString()
	} else if (this.virtualRoot !== this) {
		return nodePath.join(this.virtualRoot.toString(), this.virtualPath)
	} else if (this.parent !== this) {
		return nodePath.join(this.parent.toString(), this.name)
	} else {
		return this.path
	}
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

function FileItem_assertType<T extends FileItemType>(
	item: FileItem,
	expectedType: T,
): asserts item is FileItemOfType<T> {
	if (item.type !== expectedType) {
		throw new Error(`Expected a ${expectedType}, but got a ${item.type}: ${item}`)
	}
}

/** Whether the given object is a {@link FileItemType}. */
export function isFileItemType(obj: unknown): obj is FileItemType {
	return obj === "file" || obj === "dir"
}

export function queryFileItem<T extends FileItemType>(
	type: T,
	seed: Path | FileItem,
	...modifiers: PathModifier[]
): FileItemOfType<T> | null

export function queryFileItem(seed: Path | FileItem, ...modifiers: PathModifier[]): FileItem | null

export function queryFileItem(...args: resolvePath_Args): FileItem | null {
	const resolvedPath = resolvePath_impl(args)
	return allFileItems.get(resolvedPath) ?? null
}

export function queryDir(seed: Path | FileItem, ...modifiers: PathModifier[]): Dir | null {
	return queryFileItem("dir", seed, ...modifiers)
}

export function queryFile(seed: Path | FileItem, ...modifiers: PathModifier[]): File | null {
	return queryFileItem("file", seed, ...modifiers)
}

export function fileItem<T extends FileItemType>(
	type: T,
	seed: Path | FileItem,
	...modifiers: PathModifier[]
): FileItemOfType<T>

export function fileItem(seed: Path | FileItem, ...modifiers: PathModifier[]): FileItem

export function fileItem(...args: resolvePath_Args): FileItem {
	return fileItem_impl(args, { allowBuildRoot: false })
}

export function fileItem_impl(
	resolvePathArgs: resolvePath_Args,
	params: {
		allowBuildRoot: boolean
	},
): FileItem {
	const { allowBuildRoot } = params
	const path = resolvePath_impl(resolvePathArgs)
	return fileItem_createRecursively(path, {
		originalPath: path,
		allowBuildRoot,
	})
}

function fileItem_createRecursively(
	currentPath: Path,
	config: {
		originalPath: Path
		allowBuildRoot: boolean
	},
): FileItem {
	const existing = allFileItems.get(currentPath)
	if (existing) {
		if (existing === buildRoot && !config.allowBuildRoot) {
			throw new Error(
				`Cannot declare a path in the build directory outside of a pre-defined virtual root: ${config.originalPath}`,
			)
		}
		return existing
	}

	const parentPath_ = parentPath(currentPath)
	if (parentPath_ === currentPath) {
		return FileItem_create(null, currentPath)
	}

	const parent = fileItem_createRecursively(parentPath_, config)
	FileItem_assertType(parent, "dir")
	return FileItem_create(parent, currentPath)
}

export function file(seed: Path | FileItem, ...modifiers: PathModifier[]): File {
	return fileItem("file", seed, ...modifiers)
}

export function dir(seed: Path | FileItem, ...modifiers: PathModifier[]): Dir {
	return fileItem("dir", seed, ...modifiers)
}

export function buildFileItem<T extends FileItemType>(
	type: T,
	...modifiers: PathModifier[]
): FileItemOfType<T> {
	return fileItem_impl([type, buildRoot, ...modifiers], {
		allowBuildRoot: true,
	}) as FileItemOfType<T>
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
			throw new Error(`Path resolves to a file, but treated as a directory: ${child}`)
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
			`You should only call ${params.caller.name}() from the root directory of your project. If you use imported directories, use ${params.preferred.name}() or fileTree() to avoid ambiguity. Current directory: ${currentSourceDir}, source root directory: ${sourceRoot}`,
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
 * @param includeSelf Whether to include the pending tasks of the item itself, or just the strict
 * descendants. Defaults to `true`.
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
