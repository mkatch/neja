import { neja } from "neja"
import {
	CliEsbuildBundle,
	Cp,
	EsbuildBundle,
	Tsc,
	flags,
	hostNodeExePath,
	nodeModuleLink,
} from "./rules.neja.ts"

const cliLauncher = new EsbuildBundle()

const cliEsbuildScript = new EsbuildBundle()
cliEsbuildScript.external.push("esbuild")

const cliMain = new CliEsbuildBundle()

const lib = new EsbuildBundle()

const libTypes = new Tsc()
const packageJson = new Cp()

const publishNpmCp = flags.config === "npm" ? new Cp() : undefined

neja.sourceTree({
	"cli/": {
		"launcher.ts": cliLauncher.entryPoint,
		"main.ts": cliMain.entryPoint,
		"esbuild.ts": cliEsbuildScript.entryPoint,
	},
	"lib/": {
		"index.ts": lib.entryPoint,
		// "package.json.template": libTypesPackageJson.source,
	},
	"node_modules/": {
		"@eslint/": nodeModuleLink("eslint"),
		"esbuild/": nodeModuleLink(),
		"eslint-config-prettier/": nodeModuleLink(),
		"eslint/": nodeModuleLink(),
		"globals/": nodeModuleLink("eslint"),
		"oxfmt/": nodeModuleLink(),
		"typescript-eslint/": nodeModuleLink(),
	},
	"package.json.template": packageJson.source,
	"tsconfig.lib-types.json": libTypes.project,
})

neja.outTree({
	"cli_esbuild.js": [cliEsbuildScript.outFile, CliEsbuildBundle.buildScript],
	"cli.js": [cliLauncher.outFile, publishNpmCp?.ins],
	"cli_main.js": [cliMain.outFile, publishNpmCp.ins],
	"lib.js": [lib.outFile, publishNpmCp.ins],
	"types/": {
		".": publishNpmCp.ins,
		"neja/": libTypes.outDir,
	},

	"publish_npm/": publishNpmCp.outDir,
})

if (flags.config === "npm") {
	const packageJson = new Cp()

	neja.sourceTree({
		"package.json.template": packageJson.source,
	})

	neja.outTree({
		"publish_npm/": {
			"package.json": packageJson.destination,
		},
	})
}

neja.fileTree(neja.binRoot, {
	"neja-dev": neja.write({
		mode: 0o755,
		content: `#!${hostNodeExePath}\nimport "../out/cli.js"\n`,
		overwrite: true,
	}),
})
