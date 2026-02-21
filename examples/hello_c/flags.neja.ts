import { neja } from "neja"

const { config = "debug" } = neja.parseArgs({
	config: { type: "enum", values: ["debug", "release"] as const },
})

neja.setFlags<typeof import("./cc.neja.ts").flags>({
  optLevel: config === "debug" ? 0 : 3,
})