import { registerHooks } from "module"

const allImports = new Array<string>()

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "neja") {
			return {
				url: new URL("./lib.js", import.meta.url).href,
				shortCircuit: true,
			}
		} else {
			if (specifier.endsWith("neja.ts")) {
				console.log("Importing neja ts file:", specifier)
			}

			return nextResolve(specifier, context)
		}
	},
	load(url, context, nextLoad) {
		allImports.push(url)
		return nextLoad(url, context)
	},
})

// As variable to disable static analysis
const mainModulePath = "./cli_main.js"
const mainModule = (await import(mainModulePath)) as typeof import("./main.ts")
await mainModule.default(allImports)
