import { neja } from "neja"
import { Cat } from "./cat.neja.ts"

export const flags = await neja.resolveFlags({
	lineNumbers: neja.flag<boolean>({ required: true }),
})

export const poem = new Cat()
poem.lineNumbers = flags.lineNumbers

neja.sourceTree({
	"a.txt": poem,
	"b.txt": poem,
	"foo/": {
		"c.txt": poem,
		"d.txt": poem,
	},
	"bar/": neja.import,
})

neja.outTree({
	"poem.txt": poem.outs,
})
