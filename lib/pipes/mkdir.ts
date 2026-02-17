import { fs_mkdir } from "@util/node.ts"
import type { FilePipe } from "../pipe.ts"

export function mkdir(params?: { throwIfExists?: boolean; recursive?: boolean }): FilePipe {
	const { throwIfExists = false, recursive = false } = params ?? {}
	return {
		onFileItem(item): Promise<void> {
			if (item.type !== "dir") {
				throw new Error(`mkdir pipe can only be applied to directories, got: ${item}`)
			}
			return fs_mkdir(item.path, { throwIfExists, recursive })
		},
	}
}
