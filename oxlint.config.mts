import { defineConfig } from 'oxlint'

export default defineConfig({
	plugins: [
		'react',
		'typescript',
		'unicorn',
		'eslint',
		'oxc',
		'import',
		'promise',
	],
	categories: {
		correctness: 'error',
		suspicious: 'error',
		pedantic: 'allow',
		perf: 'error',
		style: 'allow',
		restriction: 'allow',
	},
	env: {
		builtin: true,
		es2022: true,
		browser: true,
		node: true,
	},
	ignorePatterns: [
		'dist/*',
		'**/dm.d.ts',
		'**/dm.js',
		'**/dist/**',
		'**/build/**',
		'**/.expo/**',
		'**/node_modules/**',
		'**/*.config.mjs',
		'**/*.js',
		'packages/logs/**',
		'packages/bottom-tabs-react-navigation/**',
		'packages/react-native-bottom-tabs/**',
		'**/worker-configuration.d.ts',
		'**/package-lock.json',
		'**/pnpm-lock.yaml',
		'.agents/**',
		'apps/update-server/web/src/components/ui/**', // shadcn/ui 组件，不考虑它的报错
	],
	rules: {
		'react/react-in-jsx-scope': 'off',
		'no-unused-vars': [
			'error',
			{
				args: 'all',
				argsIgnorePattern: '^_',
				caughtErrors: 'all',
				caughtErrorsIgnorePattern: '^_',
				destructuredArrayIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				ignoreRestSiblings: true,
			},
		],
		'no-console': 'error',
		'import/no-unassigned-import': ['error', { allow: ['**/*.css'] }],
		'react-hooks/exhaustive-deps': 'error',
		'typescript/no-explicit-any': 'error',
		'typescript/no-misused-promises': ['error', { checksVoidReturn: false }],
		'typescript/no-unsafe-type-assertion': 'allow',
		'typescript/consistent-return': 'off',
		'no-underscore-dangle': ['error', { allow: ['__csrf'] }],
		'react/no-unstable-nested-components': 'off',

		// oxlint 1.83 新启用/新增的规则，暂时关闭以恢复升级前的基线
		'import/no-named-as-default': 'off',
		'react/set-state-in-effect': 'off',
		'react/exhaustive-effect-dependencies': 'off',
		'react/capitalized-calls': 'off',

		// tanstack query
		'@tanstack/query/exhaustive-deps': 'error',
		'@tanstack/query/no-rest-destructuring': 'warn',
		'@tanstack/query/stable-query-client': 'error',
		'@tanstack/query/no-unstable-deps': 'error',
		'@tanstack/query/infinite-query-property-order': 'error',
		'@tanstack/query/no-void-query-fn': 'error',
		'@tanstack/query/mutation-property-order': 'error',

		// bbplayer
		'bbplayer/no-navigate-after-modal-close': 'error',

		'promise/always-return': 'allow',
		'unicorn/no-array-sort': 'allow',
		'unicorn/no-new-array': 'allow',
		'react/style-prop-object': 'allow',
		'oxc/no-map-spread': 'allow',
		'no-await-in-loop': 'allow',
	},
	settings: {
		react: {
			version: '19.2',
		},
	},
	jsPlugins: [
		'@tanstack/eslint-plugin-query',
		{ name: 'bbplayer', specifier: './packages/eslint-plugin/index.js' },
		{ name: 'drizzle-js', specifier: 'eslint-plugin-drizzle' },
		{
			name: 'import-alias',
			specifier: './oxlint-plugins/import-alias.mjs',
		},
	],
	overrides: [
		{
			files: ['apps/mobile/src/**/*.{ts,tsx,mts,cts}'],
			rules: {
				'import-alias/prefer-alias': [
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
		{
			files: ['packages/**/*.{ts,tsx,js,jsx}'],
			rules: {
				'no-console': 'allow',
			},
		},
		{
			files: ['apps/hot-update-cli/**/*.{ts,js}'],
			rules: {
				'no-console': 'allow',
			},
		},
	],
})
