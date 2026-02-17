import { fs_symlink } from "@util/node.ts"
import type { FilePipe } from "../pipe.ts"

export function symlink(targetPath: string): FilePipe {
	return {
		onFileItem(item): Promise<void> {
			return fs_symlink(targetPath, item.path, {
				type: item.type,
				recursivelyCreateDirs: true,
				overrideIfExistsAsLink: true,
			})
		}
	}
}
