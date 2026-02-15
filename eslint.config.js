import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

/** @type {import('eslint').Linter.Config[]} */
export default [
	{ files: ["**/*.{js,mjs,cjs,ts}"] }, //
	{
		languageOptions: {
			globals: globals.node,
		},
	},
	pluginJs.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	eslintConfigPrettier,
	{
		ignores: [
			"node_modules/*", //
			"build/*",
			".neja-build/*",
			"eslint.config.js",
		],
	},
	{
		rules: {
			/*
			"no-restricted-imports": [
				"error",
				{
					patterns: ["../*"],
				},
			],
			*/
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/no-unsafe-function-type": "off",
		},
	},
]
