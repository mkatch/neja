import * as neja from "../../def/index.ts"

class CCObj extends neja.Build_ {
	obj: neja.File

	constructor(src: neja.FileItem) {
		super()

		const objPath = `${neja.buildCounterpart(src)}.o`
		this.obj = neja.file(objPath)

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

class CCExe extends neja.Build_ implements neja.FileItemPipe {
	srcs = new neja.FileItemArray()

	onFileItem = this.srcs.onFileItem.bind(this.srcs)

	constructor(name: string) {
		super()
		this.outs = [neja.buildFile(name)]
	}

	rule() {
		this.ins = this.srcs.map((src) => {
			const ccObj = new CCObj(src)
			return ccObj.obj
		})

		const { ins, outs } = this.vars

		return {
			command: `cc ${ins} -o ${outs}`,
		}
	}
}

const hello = new CCExe("hello")

neja.sourceTree({
	"main.c": hello,
	"greeting.c": hello,
})
