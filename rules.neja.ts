import { neja } from "neja"

export const flags = await neja.resolveFlags({
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
