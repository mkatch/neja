import type { FileItem, FileItemPipe } from "./file"
import { absolutePath } from "./file.ts"
import { fs_mkdir } from "@util/node.ts"

class MkdirPipe implements FileItemPipe {
	throwIfExists: boolean
	recursive: boolean

	constructor(params?: { throwIfExists?: boolean; recursive?: boolean }) {
		;({ throwIfExists: this.throwIfExists = false, recursive: this.recursive = false } =
			params || {})
	}

	onFileItem(item: FileItem): FileItem {
		if (item.type !== "dir") {
			throw new Error(`mkdir pipe can only be applied to directories, got: ${item.path}`)
		}

		const absoluteDirPath = absolutePath(item)
		void fs_mkdir(absoluteDirPath, {
			throwIfExists: this.throwIfExists,
			recursive: this.recursive,
		})

		return item
	}
}

export function mkdir(params?: { recursive?: boolean }): FileItemPipe {
	return new MkdirPipe(params)
}
