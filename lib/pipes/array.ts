import type { FileItem, FileItemOfType, FileItemType } from "../file"
import { isFileItemType, File, Dir } from "../file"
import type { FilePipe, OnFileItem } from "../pipe"

/**
 * A {@link FilePipe} that collects items into an array.
 * 
 * Create using {@link fileItemArray}, {@link fileArray}, or {@link dirArray}.
 */
export interface FileArrayPipe<T extends FileItem = FileItem> extends ReadonlyArray<T>, FilePipe {
	readonly items: readonly T[]
}

class FileArrayPipeImpl extends Array<FileItem> implements FileArrayPipe  {
	type: FileItemType | null = null
	customHandler: OnFileItem | null = null

	get items(): readonly FileItem[] {
		return this
	}

	onFileItem(item: FileItem): void | Promise<void> {
		if (this.type && item.type !== this.type) {
			throw new Error(`Expected a ${this.type}, but got ${item.type}: ${item}`)
		}
		this.push(item)
		if (this.customHandler) {
			return this.customHandler(item)
		}
	}
}

type fileItemArray_Params<T extends FileItemType = FileItemType> = {
	onFileItem?: OnFileItem<FileItemOfType<T>>
}
/**
 * Create a {@link FileArrayPipe} accepting items of the specified type.
 * 
 * If you know the type statically, consider using {@link fileArray} or {@link dirArray}.
 */
export function fileItemArray<T extends FileItemType>(
	type: T,
	params?: fileItemArray_Params<T>,
): FileArrayPipe<FileItemOfType<T>>

/** Create a {@link FileArrayPipe} pipe. */
export function fileItemArray(params?: fileItemArray_Params): FileArrayPipe

export function fileItemArray(...args: unknown[]): FileArrayPipe {
	const impl = new FileArrayPipeImpl()

	let params: fileItemArray_Params | undefined
	if (isFileItemType(args[0])) {
		impl.type = args[0]
		params = args[1] as typeof params
	} else {
		params = args[0] as typeof params
	}

	if (params) {
		impl.customHandler = params.onFileItem ?? impl.customHandler
	}

	return impl
}

/**
 * Create a {@link FileArrayPipe} accepting {@link File} items.
 * 
 * Convenience wrapper over {@link fileItemArray}.
 */
export function fileArray(params?: fileItemArray_Params<"file">): FileArrayPipe<File> {
	return fileItemArray("file", params)
}

/**
 * Create a {@link FileArrayPipe} accepting {@link Dir} items.
 * 
 * Convenience wrapper over {@link fileItemArray}.
 */
export function dirArray(params?: fileItemArray_Params<"dir">): FileArrayPipe<Dir> {
	return fileItemArray("dir", params)
}
