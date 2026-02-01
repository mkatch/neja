import { neja } from "neja"
import { EsbuildBundle, Tsc } from "./rules.neja.ts"

const cliLauncher = new EsbuildBundle()

const cliMain = new EsbuildBundle()
cliMain.external.push("neja")

export const libTypes = new Tsc()

neja.sourceTree({
	"cli/": {
		"launcher.ts": cliLauncher.entryPoint,
		"main.ts": cliMain.entryPoint,
	},
	"tsconfig.lib-types.json": libTypes.project,
})

neja.buildTree({
	"cli.js": cliLauncher.outFile,
	"cli_main.js": cliMain.outFile,
	"types/": {
		"neja/": libTypes.outDir,
	},
})
