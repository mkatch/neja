import * as path from "path"
import { addDiscoveryTaskIfPromise } from "./scheduling.ts"
import { captureCurrentBuildDir, captureCurrentSourceDir, config } from "./env.ts"

const allFileItems = new Map<string, FileItem>()

export class File {
	type = "file" as const
	path: string
	parent: Dir

	constructor(parent: Dir, path: string) {
		this.parent = parent
		this.path = path
		FileItem_register(this)
	}

	toString(): string {
		return this.path
	}
}

export class Dir {
	type = "dir" as const
	path: string
	parent: Dir | null
	children = new Array<FileItem>()

	constructor(parent: Dir | null, path: string) {
		this.parent = parent
		this.path = path
		FileItem_register(this)
	}

	toString(): string {
		return this.path
	}
}

export const sourceDir = new Dir(null, "${sourcedir}")

export const buildDir = new Dir(null, "${builddir}")

export type FileItem = File | Dir

function FileItem_register(item: FileItem): void {
	if (allFileItems.has(item.path)) {
		throw new Error(`File item already registered: ${item.path}`)
	}
	allFileItems.set(item.path, item)
}

export function buildFile(relativeFilePath: string): File {
	const fullPath = path.join(buildDir.path, relativeFilePath)
	return file(fullPath)
}

type DirDeclValue = DirDecl | FileItemPipe

type DirDecl = {
	[key in string]: DirDeclValue
}

function DirDeclValue_isPipe(value: DirDeclValue): value is FileItemPipe {
	return value.onFileItem && typeof value.onFileItem === "function"
}

function FileItem_assertType<T extends FileItem["type"]>(
	item: FileItem,
	type: T,
): asserts item is Extract<FileItem, { type: T }> {
	if (item.type !== type) {
		throw new Error(
			`File item has been previously declared as "${item.type}", but now referred to as "${type}": ${item.path}`,
		)
	}
}

export function queryFileItem<T extends FileItem["type"]>(
	itemPath: string,
	type: T,
): Extract<FileItem, { type: T }> | null {
	const item = allFileItems.get(itemPath)
	if (item) {
		FileItem_assertType(item, type)
		return item
	} else {
		const normalizedPath = path.normalize(itemPath)
		return queryFileItemNaive(normalizedPath, type)
	}
}

export function queryFileItemNaive<T extends FileItem["type"]>(
	normalizedPath: string,
	type: T,
): Extract<FileItem, { type: T }> | null {
	const item = allFileItems.get(normalizedPath)
	if (item) {
		FileItem_assertType(item, type)
		return item
	} else {
		return null
	}
}

export function queryDir(path: string): Dir | null {
	return queryFileItem(path, "dir")
}

export function queryDirNaive(normalizedPath: string): Dir | null {
	return queryFileItemNaive(normalizedPath, "dir")
}

export function queryFile(path: string): File | null {
	return queryFileItem(path, "file")
}

export function queryFileNaive(normalizedPath: string): File | null {
	return queryFileItemNaive(normalizedPath, "file")
}

export function file(filePath: string): File {
	const existing = queryFileNaive(filePath)
	if (existing) {
		return existing
	}

	if (filePath.endsWith("\\") || filePath.endsWith("/")) {
		throw new Error(`File path must not end with a slash: ${filePath}`)
	}

	const normalizedPath = path.normalize(filePath)
	const parentPath = path.dirname(normalizedPath)
	const parentDir = dir_aux(parentPath, filePath)
	return new File(parentDir, normalizedPath)
}

export function dir(dirPath: string): Dir {
	const existing = queryDirNaive(dirPath)
	if (existing) {
		return existing
	}

	let dirPathNoSlash = dirPath
	if (dirPath.endsWith("\\") || dirPath.endsWith("/")) {
		dirPathNoSlash = dirPath.slice(0, -1)
	}

	const normalizedPath = path.normalize(dirPathNoSlash)
	return dir_aux(normalizedPath, dirPath)
}

function dir_aux(dirPath: string, originalPath: string): Dir {
	const existing = queryDirNaive(dirPath)
	if (existing) {
		return existing
	}

	const parentPath = path.dirname(dirPath)
	if (parentPath === dirPath || parentPath === "" || parentPath === ".") {
		throw new Error(`Not in any of the allowed roots: ${originalPath}`)
	}

	const parentDir = dir_aux(parentPath, originalPath)
	return new Dir(parentDir, dirPath)
}

export function fileTree(dir: Dir, decl: DirDecl): Dir {
	for (const [key, value] of Object.entries(decl)) {
		if (key.endsWith("/")) {
			const childDirPath = path.join(dir.path, key.slice(0, -1))
			const childDir = queryDir(childDirPath) || new Dir(dir, childDirPath)
			dir.children.push(childDir)

			if (DirDeclValue_isPipe(value)) {
				addDiscoveryTaskIfPromise(value.onFileItem(childDir))
			} else {
				fileTree(childDir, value)
			}
		} else if (DirDeclValue_isPipe(value)) {
			if (key === ".") {
				addDiscoveryTaskIfPromise(value.onFileItem(dir))
			} else {
				const filePath = path.join(dir.path, key)
				const file = queryFile(filePath) || new File(dir, filePath)
				dir.children.push(file)
				addDiscoveryTaskIfPromise(value.onFileItem(file))
			}
		} else {
			throw new Error("Directories must be declared with names ending with '/'")
		}
	}
	return dir
}

export function sourceTree(decl: DirDecl): Dir {
	return fileTree(captureCurrentSourceDir(), decl)
}

export function buildTree(decl: DirDecl): Dir {
	return fileTree(captureCurrentBuildDir(), decl)
}

export function buildCounterpart(itemOrPath: FileItem | string): string {
	const filePath = typeof itemOrPath === "string" ? itemOrPath : itemOrPath.path
	if (!filePath.startsWith(sourceDir.path)) {
		throw new Error(`Path is not under source dir: ${filePath}`)
	}
	const relativePath = filePath.slice(sourceDir.path.length)
	return `${buildDir.path}${relativePath}`
}

export interface FileItemPipe<
	In extends FileItem = FileItem,
	Out extends In | Promise<In> = In | Promise<In>,
> {
	onFileItem(item: In): Out
}

export class FileItemArray<F extends FileItem> extends Array<FileItem> implements FileItemPipe<F> {
	onFileItem(item: F): F {
		this.push(item)
		return item
	}
}

export const imported: FileItemPipe = {
	async onFileItem(item) {
		if (item.type !== "dir") {
			throw new Error("Only directories can be marked as imported.")
		}
		if (!item.path.startsWith(sourceDir.path)) {
			throw new Error(`Imported directory must be under source dir: ${item.path}`)
		}
		const relativePath = item.path.slice(sourceDir.path.length + 1)
		const importedProjectPath = path.join(config.sourceDir, relativePath, "neja.ts")

		await import(importedProjectPath)

		return item
	},
}
