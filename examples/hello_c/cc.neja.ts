import { neja } from "neja"

export const flags = await neja.resolveFlags({
	optLevel: neja.flag<0 | 1 | 2 | 3>({ required: true })
})

const optFlag = `-O${flags.optLevel}`

export class CCObj extends neja.Rule {
	obj: neja.File

	constructor(src: neja.File) {
		super()

		this.obj = neja.file(neja.outRoot, src, (path) => `${path}.o`)

		this.ins = [src]
		this.outs = [this.obj]
	}

	command() {
		const { ins, outs } = this.vars

		return {
			command: `cc -c ${ins} -o ${outs} ${optFlag} -MMD -MF ${outs}.d`,
			depfile: `${outs}.d`,
		}
	}
}

export class CCExe extends neja.Rule implements neja.FilePipe {
	srcs = neja.fileArray()

	onFileItem = this.srcs.onFileItem.bind(this.srcs)

	constructor(name: string) {
		super()
		this.outs = [neja.file(neja.outRoot, name)]
	}

	effect() {
		this.ins = this.srcs.map((src) => {
			const ccObj = new CCObj(src)
			return ccObj.obj
		})
	}

	command() {
		const { ins, outs } = this.vars

		return {
			command: `cc ${ins} ${optFlag} -o ${outs}`,
		}
	}
}
