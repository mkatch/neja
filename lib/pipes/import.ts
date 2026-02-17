import { fs_exists } from "@util/node"
import { sourceRoot } from "../file"
import type { FilePipe } from "../pipe"
import { isDescendant, resolvePath } from "../path"

const NEJAFILE_NAMES = ["neja.ts", "neja.js"] as const

export const importPipe: FilePipe = {
	async onFileItem(item): Promise<void> {
		if (item.type !== "dir") {
			throw new Error(`Only directories can be imported, got: "${item}"`)
		}
		if (!isDescendant(sourceRoot, item, { includeSelf: false })) {
			throw new Error(
				`Can only import items from the source root, but "${item}" is not a descendant of "${sourceRoot}"`,
			)
		}

		for (const name of NEJAFILE_NAMES) {
			const nejafilePath = resolvePath(item, name)
			if (await fs_exists(nejafilePath)) {
				await import(nejafilePath)
				return
			}
		}
	},
}
