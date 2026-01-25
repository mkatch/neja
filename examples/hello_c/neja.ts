import * as neja from "../../def/index.ts"
import { CCExe } from "./cc.neja.ts"

const hello = new CCExe("hello")

neja.sourceTree({
	"main.c": hello,
	"greeting.c": hello,
})
