import type { FileItem, FileItemPipe } from "./file.ts"
import { absolutePath } from "./file.ts"
import { fs_symlink } from "@util/node.ts"

class SymlinkPipe implements FileItemPipe {
	targetPath: string

	constructor(targetPath: string) {
		this.targetPath = targetPath
	}

	onFileItem(item: FileItem): FileItem {
		const absoluteLinkPath = absolutePath(item)
		// TODO: We don't need to wait for it here, but we do want to wait before process exit.
		void fs_symlink(this.targetPath, absoluteLinkPath, {
			type: item.type,
			recursivelyCreateDirs: true,
			overrideIfExistsAsLink: true,
		})
		return item
	}
}

export function symlink(targetPath: string): FileItemPipe<FileItem, FileItem> {
	return new SymlinkPipe(targetPath)
}
