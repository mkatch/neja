import { neja } from "neja"
import { CCExe } from "./cc.neja.ts"

const hello = new CCExe("hello")
export default hello

neja.sourceTree({
	"main.c": hello,
	"greeting.c": hello,
})
