import esbuild from "esbuild"
import { parseArgs } from "util"

async function main() {
	const {
		values: { outfile },
		positionals: [_node, _script, entryPoint],
	} = parseArgs({
		args: process.argv,
		options: {
			outfile: { type: "string" },
		},
		allowPositionals: true,
	})

	if (!outfile) {
		throw new Error("Must provide outfile")
	}
	if (!entryPoint) {
		throw new Error("Must provide entry point")
	}

	// While it's convenient during development to reference the source files directly, it is
	// important that the imported neja library is external and shared with the one imported by the
	// processed project files. The correctness of the discovery process relies on a shared global
	// state.
	const rewriteNejaImports: esbuild.Plugin = {
		name: "rewrite-neja-imports",
		setup(build) {
			build.onResolve({ filter: /^@lib$/ }, () => ({
				path: "neja",
				external: true,
			}))
		},
	}

	await esbuild.build({
		entryPoints: [entryPoint],
		outfile,
		bundle: true,
		platform: "node",
		format: "esm",
		plugins: [rewriteNejaImports],
	})
}

await main()
