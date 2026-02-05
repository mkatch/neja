import * as fs from "fs"
import * as path from "path"
import { absolutePath } from "./file"
import type { FileItem, FileItemPipe } from "./file"
import { fs_exists } from "@util/node"

export function write(params: {
	content: string
	overwrite?: boolean
	mode?: fs.Mode
	createDirectoriesRecursively?: boolean
}): FileItemPipe<FileItem, Promise<FileItem>> {
	const { content, overwrite = false, mode, createDirectoriesRecursively = true } = params

	return {
		async onFileItem(item) {
			if (item.type !== "file") {
				throw new Error("write expects a file, but got: " + item.type)
			}

			const fullPath = absolutePath(item)

			if (!overwrite) {
				const exists = await fs_exists(fullPath)
				if (exists) {
					return item
				}
			}

			if (createDirectoriesRecursively) {
				const parentDirPath = path.dirname(fullPath)
				await fs.promises.mkdir(parentDirPath, { recursive: true })
			}

			await fs.promises.writeFile(fullPath, content, { mode, encoding: "utf-8" })

			return item
		},
	}
}
