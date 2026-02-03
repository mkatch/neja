import { neja } from "neja"
import { Cp, EsbuildBundle, Tsc, nodeModuleLink } from "./rules.neja.ts"

const cliLauncher = new EsbuildBundle()

const cliMain = new EsbuildBundle()
cliMain.external.push("neja")

const lib = new EsbuildBundle()

const libTypes = new Tsc()
const libTypesPackageJson = new Cp()

neja.sourceTree({
	"cli/": {
		"launcher.ts": cliLauncher.entryPoint,
		"main.ts": cliMain.entryPoint,
	},
	"lib/": {
		"index.ts": lib.entryPoint,
		"package.json.template": libTypesPackageJson.source,
	},
	"node_modules/": {
		"eslint/": nodeModuleLink(),
		"globals/": nodeModuleLink("eslint"),
		"@eslint/": nodeModuleLink("eslint"),
		"typescript-eslint/": nodeModuleLink(),
		"eslint-config-prettier/": nodeModuleLink(),
	},
	"tsconfig.lib-types.json": libTypes.project,
})

neja.buildTree({
	"cli.js": cliLauncher.outFile,
	"cli_main.js": cliMain.outFile,
	"lib.js": lib.outFile,
	"types/": {
		"neja/": {
			".": libTypes.outDir,
			"package.json": libTypesPackageJson.destination,
		},
	},
})
