import * as neja from "../../def/index.ts"
import { Cat } from "./cat.neja.ts"

export const poem = new Cat()
poem.lineNumbers = true

neja.sourceTree({
	"a.txt": poem,
	"b.txt": poem,
	"foo/": {
		"c.txt": poem,
		"d.txt": poem,
	},
	"bar/": neja.imported,
})

neja.buildTree({
	"poem.txt": poem.outs,
})
