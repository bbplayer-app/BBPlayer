import importAlias from '@dword-design/eslint-plugin-import-alias'
import oxlint from 'eslint-plugin-oxlint'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
	{
		ignores: ['dist/*', '**/dm.d.ts', '**/dm.js'],
	},
	{
		files: ['**/*.{ts,tsx,mts,cts}'],
		languageOptions: {
			parser: tseslint.parser,
		},
	},
	{
		...importAlias.configs.recommended,
		files: ['apps/mobile/src/**/*.{js,mjs,cjs,ts,jsx,tsx}'],
		rules: {
			'@dword-design/import-alias/prefer-alias': [
				'error',
				{
					alias: {
						'@': './apps/mobile/src',
					},
					aliasForSubpaths: true,
				},
			],
		},
	},
	...oxlint.configs['flat/recommended'],
])
