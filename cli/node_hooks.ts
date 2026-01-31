import { registerHooks } from "module"

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "neja") {
			return {
				url: new URL("./lib.js", import.meta.url).href,
				shortCircuit: true,
			}
		} else {
			return nextResolve(specifier, context)
		}
	},
})
