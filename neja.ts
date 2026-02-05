import * as path from "path"
import { neja } from "neja"
import { Cp, EsbuildBundle, Tsc, nodeModuleLink, flags } from "./rules.neja.ts"

const cliLauncher = new EsbuildBundle()

const cliMain = new EsbuildBundle()
cliMain.external.push("neja")

const lib = new EsbuildBundle()

const libTypes = new Tsc()
const libTypesPackageJson = new Cp()

const hostNodeExePath = path.join(flags.hostNodePath, "bin", "node")

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
	"bin/": {
		"neja-dev": neja.write({
			mode: 0o755,
			content: `#!${hostNodeExePath}\nimport "../cli.js"\n`,
			overwrite: true,
		}),
	},
})
