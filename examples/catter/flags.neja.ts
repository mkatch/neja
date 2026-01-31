import { neja } from "neja"
import type { flags } from "./neja.ts"

neja.setFlags<typeof flags>({
	lineNumbers: true,
})
