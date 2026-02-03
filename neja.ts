import { neja } from "neja"
import { Cp, EsbuildBundle, Tsc } from "./rules.neja.ts"

const cliLauncher = new EsbuildBundle()

const cliMain = new EsbuildBundle()
cliMain.external.push("neja")

const libTypes = new Tsc()
const libTypesPackageJson = new Cp()

neja.sourceTree({
	"cli/": {
		"launcher.ts": cliLauncher.entryPoint,
		"main.ts": cliMain.entryPoint,
	},
	"lib/": {
		"package.json.template": libTypesPackageJson.source,
	},
	"tsconfig.lib-types.json": libTypes.project,
})

neja.buildTree({
	"cli.js": cliLauncher.outFile,
	"cli_main.js": cliMain.outFile,
	"types/": {
		"neja/": {
			".": libTypes.outDir,
			"package.json": libTypesPackageJson.destination,
		},
	},
})
