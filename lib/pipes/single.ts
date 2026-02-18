import type { Dir, File, FileItem, FileItemOfType, FileItemType } from "../file"
import { isFileItemType } from "../file"
import type { FilePipe, OnFileItem } from "../pipe"

/**
 * A {@link FilePipe} that accepts a single item.
 *
 * Create using {@link singleFileItem}, {@link singleFile}, or {@link singleDir}.
 */
export interface SingleFilePipe<out T extends FileItem = FileItem> extends FilePipe {
	readonly item: T | null
}

/**
 * A {@link FilePipe} that accepts a single item and requires it to be present upon access.
 *
 * Create using {@link singleFileItem}, {@link singleFile}, or {@link singleDir} with `required:
 * true`.
 */
export interface RequiredSingleFilePipe<out T extends FileItem = FileItem> extends SingleFilePipe<T> {
	readonly item: T
}

class SingleFilePipeImpl implements SingleFilePipe {
	private item_: FileItem | null = null
	type: FileItemType | null = null
	required = true
	allowReassign = false
	customHandler: OnFileItem | null = null

	get item(): FileItem | null {
		if (!this.item_) {
			if (this.required) {
				throw new Error("Expected a file item, but none was assigned.")
			}
			return null
		}
		return this.item_ as FileItem | null
	}

	onFileItem(item: FileItem): void | Promise<void> {
		if (this.type && item.type !== this.type) {
			throw new Error(`Expected a ${this.type}, but got ${item.type}: ${item}`)
		}
		if (this.item_ && !this.allowReassign) {
			throw new Error(
				`Expected only one item, but got multiple. Already have "${this.item_}", received: ${item}`,
			)
		}
		this.item_ = item
		if (this.customHandler) {
			return this.customHandler(item)
		}
	}

	toString(): string {
		return this.item?.toString() ?? "" // TODO: Is this the best way to represent a missing value?
	}
}

interface singleFileItem_Params<T extends FileItemType = FileItemType> {
	required?: boolean
	allowReassign?: boolean
	onFileItem?: OnFileItem<FileItemOfType<T>>
}

/**
 * Create a {@link RequiredSingleFilePipe} accepting items of the specified type.
 *
 * If you know the type statically, consider using {@link singleFile} or {@link singleDir}.
 */
export function singleFileItem<T extends FileItemType>(
	type: T,
	params: { required: true } & singleFileItem_Params<T>,
): RequiredSingleFilePipe<FileItemOfType<T>>

/**
 * Create a {@link RequiredSingleFilePipe}.
 */
export function singleFileItem(
	params: { required: true } & singleFileItem_Params,
): RequiredSingleFilePipe<FileItem>

export function singleFileItem<T extends FileItemType>(
	type: T,
	params?: singleFileItem_Params<T>,
): SingleFilePipe<FileItemOfType<T>>

/** Create a {@link SingleFilePipe}. */
export function singleFileItem(params?: singleFileItem_Params): SingleFilePipe<FileItem>

export function singleFileItem(...args: unknown[]): SingleFilePipe<FileItem> {
	const impl = new SingleFilePipeImpl()

	let params: singleFileItem_Params | undefined
	if (isFileItemType(args[0])) {
		impl.type = args[0]
		params = args[1] as typeof params
	} else {
		params = args[0] as typeof params
	}

	if (params) {
		impl.required = params.required ?? impl.required
		impl.allowReassign = params.allowReassign ?? impl.allowReassign
		impl.customHandler = params.onFileItem ?? impl.customHandler
	}

	return impl
}

/**
 * Create a {@link RequiredSingleFilePipe} accepting {@link File} items.
 * 
 * Convenience wrapper over {@link singleFileItem}.
 */
export function singleFile(
	params: { required: true } & singleFileItem_Params<"file">,
): RequiredSingleFilePipe<File>

/**
 * Create a {@link SingleFilePipe} accepting {@link File} items.
 * 
 * Convenience wrapper over {@link singleFileItem}.
 */
export function singleFile(params?: singleFileItem_Params<"file">): SingleFilePipe<File>

export function singleFile(params?: singleFileItem_Params<"file">): SingleFilePipe<File> {
	return singleFileItem("file", params)
}

/**
 * Create a {@link RequiredSingleFilePipe} accepting {@link Dir} items.
 * 
 * Convenience wrapper over {@link singleFileItem}.
 */
export function singleDir(
	params: { required: true } & singleFileItem_Params<"dir">,
): RequiredSingleFilePipe<Dir>

/**
 * Create a {@link SingleFilePipe} accepting {@link Dir} items.
 * 
 * Convenience wrapper over {@link singleFileItem}.
 */
export function singleDir(params?: singleFileItem_Params<"dir">): SingleFilePipe<Dir>

export function singleDir(params?: singleFileItem_Params<"dir">): SingleFilePipe<Dir> {
	return singleFileItem("dir", params)
}
