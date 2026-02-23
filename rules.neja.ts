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

	tscCommand: neja.flag<string>({ required: true }),
})

export class EsbuildBundle extends neja.Rule {
	entryPoint = neja.singleFile({ required: true })
	outFile = neja.singleFile({ required: true })
	external = new Array<string>()
	externalFlags?: string
	alwaysDirty = true

	command() {
		this.ins = [this.entryPoint.item]
		this.outs = [this.outFile.item]

		if (this.external.length > 0) {
			this.externalFlags = this.external.map((ext) => `--external:${ext}`).join(" ")
		}

		const { ins, outs, externalFlags } = this.vars

		return {
			command: `${esbuildExePath} ${ins} --bundle --platform=node --format=esm --sourcemap=linked --sources-content=false ${externalFlags} --outfile=${outs}`,
			description: `Create bundle ${outs} from entry point ${ins}.`,
		}
	}
}

export class CliEsbuildBundle extends neja.Rule {
	static buildScript = neja.singleFile({ required: true })

	entryPoint = neja.singleFile({ required: true })
	outFile = neja.singleFile({ required: true })
	alwaysDirty = true

	command() {
		this.ins = [CliEsbuildBundle.buildScript.item, this.entryPoint.item]
		this.outs = [this.outFile.item]

		const { ins, outs } = this.vars

		return {
			command: `${hostNodeExePath} ${ins} --outfile=${outs}`,
			description: `Create bundle ${outs}`,
		}
	}
}

export class Tsc extends neja.Rule {
	project = neja.singleFile({ required: true })
	outDir = neja.singleDir({ required: true })
	alwaysDirty = true

	command() {
		this.ins = [this.project.item]

		const { ins, outDir } = this.vars

		return {
			command: `${flags.tscCommand} -p ${ins} --outDir ${outDir}`,
			description: `Compile TypeScript project ${ins} to output directory ${outDir}.`,
		}
	}
}

export class Cp extends neja.Rule {
	source = neja.singleFile({ required: true })
	destination = neja.singleFile({ required: true })

	command() {
		this.ins = [this.source.item]
		this.outs = [this.destination.item]

		const { ins, outs } = this.vars

		return {
			command: `cp ${ins} ${outs}`,
			description: `Copy ${ins} to ${outs}.`,
		}
	}
}

function hostNodeModulePath(moduleName: string, parent?: string): string {
	return parent
		? path.join(nodeModulesPath, parent, "node_modules", moduleName)
		: path.join(nodeModulesPath, moduleName)
}

export function nodeModuleLink(parent?: string): neja.FilePipe {
	return {
		onFileItem(item) {
			if (item.type !== "dir") {
				throw new Error("nodeModuleLink can only be used with directory items.")
			}
			const moduleName = path.basename(item.path)
			const target = hostNodeModulePath(moduleName, parent)
			return neja.symlink(target).onFileItem(item)
		},
	}
}

const nodeModulesPath = path.join(flags.hostNodePath, "lib", "node_modules")
export const hostNodeExePath = path.join(flags.hostNodePath, "bin", "node")
export const esbuildExePath = path.join(hostNodeModulePath("esbuild"), "bin", "esbuild")
