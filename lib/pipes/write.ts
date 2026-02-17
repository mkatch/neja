import * as fs from "fs"
import { fs_exists } from "@util/node"
import type { FilePipe } from "../pipe"

export function write(params: {
	content: string
	overwrite?: boolean
	mode?: fs.Mode
	createDirectoriesRecursively?: boolean
}): FilePipe {
	const { content, overwrite = false, mode, createDirectoriesRecursively = true } = params

	return {
		async onFileItem(item): Promise<void> {
			if (item.type !== "file") {
				throw new Error(`write expects a file, got: ${item}`)
			}

			if (!overwrite) {
				const exists = await fs_exists(item.path)
				if (exists) {
					return
				}
			}

			if (createDirectoriesRecursively) {
				await fs.promises.mkdir(item.parent.path, { recursive: true })
			}

			await fs.promises.writeFile(item.path, content, { mode, encoding: "utf-8" })
		},
	}
}
