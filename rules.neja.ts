import { neja } from "neja"

export const flags = await neja.resolveFlags({
	esbuildCommand: neja.flag<string>({ required: true }),
	tscCommand: neja.flag<string>({ required: true }),
})

export class EsbuildBundle extends neja.Build {
	entryPoint = new neja.SingleFileItemPipe()
	outFile = new neja.SingleFileItemPipe()
	external = new Array<string>()

	externalFlags = ""

	rule() {
		if (!this.entryPoint.item) {
			throw new Error("EsbuildBundle requires an entry point.")
		}
		if (!this.outFile.item) {
			throw new Error("EsbuildBundle requires an output file.")
		}

		this.ins = [this.entryPoint.item]
		this.outs = [this.outFile.item]

		// TODO: make optional
		this.externalFlags = this.external.map((ext) => `--external:${ext}`).join(" ")

		const { ins, outs, externalFlags } = this.vars

		return {
			command: `${flags.esbuildCommand} ${ins} --bundle --platform=node --format=esm ${externalFlags} --outfile=${outs}`,
			description: `Create bundle ${outs} from entry point ${ins}.`,
		}
	}
}

export class Tsc extends neja.Build {
	project = new neja.SingleFileItemPipe()
	outDir = new neja.SingleFileItemPipe()

	rule() {
		if (!this.project.item) {
			throw new Error("Tsc requires a project file.")
		}
		if (!this.outDir.item) {
			throw new Error("Tsc requires an output directory.")
		}

		const { project, outDir } = this.vars

		return {
			command: `${flags.tscCommand} -p ${project} --outDir ${outDir}`,
			description: `Compile TypeScript project ${project} to output directory ${outDir}.`,
		}
	}
}
