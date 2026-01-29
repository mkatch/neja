import * as neja from "../../def/index.ts"
import type { flags } from "./neja.ts"

neja.setFlags<typeof flags>({
	lineNumbers: true,
})
