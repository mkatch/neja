import * as path from "path"
import { neja } from "neja"

export const flags = await neja.resolveFlags({
	/**
	 * Path to the Node.js installation of the host machine. Should be the root directory, right
	 * before "bin" and "lib".
	 *
	 * This version is used to run the build tasks and language tools.
	 *
	 * At the moment, this is also the version that the build is targeting, but technically it doesn't
	 * have to be this way. Might change if there is ever a need, e.g., when you want latest developer
	 * experience, but the final program should work with an older runtime.
	 */
	hostNodePath: neja.flag<string>({ required: true }),

	esbuildCommand: neja.flag<string>({ required: true }),

	tscCommand: neja.flag<string>({ required: true }),
})

export class EsbuildBundle extends neja.Build {
	entryPoint = new neja.SingleFileItemPipe()
	outFile = new neja.SingleFileItemPipe()
	external = new Array<string>()
	externalFlags?: string
	alwaysDirty = true

	rule() {
		if (!this.entryPoint.item) {
			throw new Error("EsbuildBundle requires an entry point.")
		}
		if (!this.outFile.item) {
			throw new Error("EsbuildBundle requires an output file.")
		}

		this.outs = [this.outFile.item]

		if (this.external.length > 0) {
			this.externalFlags = this.external.map((ext) => `--external:${ext}`).join(" ")
		}

		const { entryPoint, outs, externalFlags } = this.vars

		return {
			command: `${flags.esbuildCommand} ${entryPoint} --bundle --platform=node --format=esm ${externalFlags} --outfile=${outs}`,
			description: `Create bundle ${outs} from entry point ${entryPoint}.`,
		}
	}
}

export class Tsc extends neja.Build {
	project = new neja.SingleFileItemPipe()
	outDir = new neja.SingleFileItemPipe()
	alwaysDirty = true

	rule() {
		if (!this.project.item) {
			throw new Error("Tsc requires a project file.")
		}
		if (!this.outDir.item) {
			throw new Error("Tsc requires an output directory.")
		}

		this.ins = [this.project.item]

		const { ins, outDir } = this.vars

		return {
			command: `${flags.tscCommand} -p ${ins} --outDir ${outDir}`,
			description: `Compile TypeScript project ${ins} to output directory ${outDir}.`,
		}
	}
}

export class Cp extends neja.Build {
	source = new neja.SingleFileItemPipe()
	destination = new neja.SingleFileItemPipe()

	rule() {
		if (!this.source.item) {
			throw new Error("Cp requires a source file.")
		}
		if (!this.destination.item) {
			throw new Error("Cp requires a destination file or directory.")
		}

		this.ins = [this.source.item]
		this.outs = [this.destination.item]

		const { ins, outs } = this.vars

		return {
			command: `cp ${ins} ${outs}`,
			description: `Copy ${ins} to ${outs}.`,
		}
	}
}

const nodeModulesPath = path.join(flags.hostNodePath, "lib", "node_modules")

export function nodeModuleLink(parent?: string): neja.FileItemPipe {
	return {
		onFileItem(item: neja.FileItem): neja.FileItem {
			if (item.type !== "dir") {
				throw new Error("nodeModuleLink can only be used with directory items.")
			}
			const moduleName = path.basename(item.path)
			const target = parent
				? path.join(nodeModulesPath, parent, "node_modules", moduleName)
				: path.join(nodeModulesPath, moduleName)
			return neja.symlink(target).onFileItem(item)
		},
	}
}
