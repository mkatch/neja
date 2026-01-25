import * as neja from "../../def/index.ts"

export class Cat extends neja.Build implements neja.FileItemPipe {
	ins = new neja.FileItemArray()
	outs = new neja.FileItemArray()
	lineNumbers = false

	onFileItem = this.ins.onFileItem.bind(this.ins)

	rule() {
		let command = "cat"

		if (this.lineNumbers) {
			command += " -n"
		}

		if (this.outs.length > 1) {
			throw new Error("Cat build supports only single output file.")
		}

		const { ins, outs } = this.vars

		command += ` ${ins}`

		if (this.outs.length === 1) {
			command += ` > ${outs}`
		}

		return { command }
	}
}
