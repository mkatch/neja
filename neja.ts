import { neja } from "neja"
import { CliEsbuildBundle, Cp, EsbuildBundle, Tsc, hostNodeExePath, nodeModuleLink } from "./rules.neja.ts"

const cliLauncher = new EsbuildBundle()

const cliEsbuildScript = new EsbuildBundle()
cliEsbuildScript.external.push("esbuild")

const cliMain = new CliEsbuildBundle()

const lib = new EsbuildBundle()

const libTypes = new Tsc()
const libTypesPackageJson = new Cp()


neja.sourceTree({
	"cli/": {
		"launcher.ts": cliLauncher.entryPoint,
		"main.ts": cliMain.entryPoint,
		"esbuild.ts": cliEsbuildScript.entryPoint
	},
	"lib/": {
		"index.ts": lib.entryPoint,
		"package.json.template": libTypesPackageJson.source,
	},
	"node_modules/": {
		"esbuild/": nodeModuleLink(),
		"eslint/": nodeModuleLink(),
		"globals/": nodeModuleLink("eslint"),
		"@eslint/": nodeModuleLink("eslint"),
		"typescript-eslint/": nodeModuleLink(),
		"eslint-config-prettier/": nodeModuleLink(),
	},
	"tsconfig.lib-types.json": libTypes.project,
})

neja.buildTree({
	"cli_esbuild.js": {
		onFileItem: (item) => {
			cliEsbuildScript.outFile.onFileItem(item)
			CliEsbuildBundle.buildScript.onFileItem(item)
			return item
		}
	},
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
