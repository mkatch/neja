import { neja } from "neja"
import { EsbuildBundle, Tsc } from "./rules.neja.ts"

export const cliBinary = new EsbuildBundle()
cliBinary.external.push("neja")

export const cliNodeHooks = new EsbuildBundle()

export const libTypes = new Tsc()

neja.sourceTree({
	"cli/": {
		"main.ts": cliBinary.entryPoint,
		"node_hooks.ts": cliNodeHooks.entryPoint,
	},
	"tsconfig.lib-types.json": libTypes.project,
})

neja.buildTree({
	"cli.js": cliBinary.outFile,
	"node_hooks.js": cliNodeHooks.outFile,
	"types/": {
		"neja/": libTypes.outDir,
	},
})
