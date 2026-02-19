import { neja } from "neja"

export class Cat extends neja.Rule implements neja.FilePipe {
	ins = neja.fileArray()
	outs = neja.fileArray()
	lineNumbers = false

	onFileItem = this.ins.onFileItem.bind(this.ins)

	command() {
		let command = "cat"

		if (this.lineNumbers) {
			command += " -n"
		}

		if (this.outs.length !== 1) {
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
