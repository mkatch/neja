import { neja } from "neja"

export class CCObj extends neja.Build {
	obj: neja.File

	constructor(src: neja.File) {
		super()

		this.obj = neja.file(neja.outRoot, src, (path) => `${path}.o`)

		this.ins = [src]
		this.outs = [this.obj]
	}

	rule() {
		const { ins, outs } = this.vars

		return {
			command: `cc -c ${ins} -o ${outs}`,
		}
	}
}

export class CCExe extends neja.Build implements neja.FilePipe {
	srcs = neja.fileArray()

	onFileItem = this.srcs.onFileItem.bind(this.srcs)

	constructor(name: string) {
		super()
		this.outs = [neja.file(neja.outRoot, name)]
	}

	effect = () => {
		this.ins = this.srcs.map((src) => {
			const ccObj = new CCObj(src)
			return ccObj.obj
		})
	}

	rule() {
		const { ins, outs } = this.vars

		return {
			command: `cc ${ins} -o ${outs}`,
		}
	}
}
