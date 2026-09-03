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
		'react-hooks/exhaustive-deps': 'error',
		'typescript/no-explicit-any': 'error',
		'typescript/no-misused-promises': ['error', { checksVoidReturn: false }],
		'typescript/no-unsafe-type-assertion': 'allow',
		'typescript/consistent-return': 'off',
		'no-underscore-dangle': ['error', { allow: ['__csrf'] }],
		'react/no-unstable-nested-components': 'off',

		// tanstack query
		'tanstack-query/exhaustive-deps': 'error',
		'tanstack-query/no-rest-destructuring': 'warn',
		'tanstack-query/stable-query-client': 'error',
		'tanstack-query/no-unstable-deps': 'error',
		'tanstack-query/infinite-query-property-order': 'error',
		'tanstack-query/no-void-query-fn': 'error',
		'tanstack-query/mutation-property-order': 'error',

		// react-compiler
		'react-compiler-js/react-compiler': 'error',

		// bbplayer
		'bbplayer/no-navigate-after-modal-close': 'error',

		// react-hooks-extra
		'react-hooks-extra-js/no-direct-set-state-in-use-effect': 'off',
		'react-hooks-extra-js/no-unnecessary-use-prefix': 'error',
		'react-hooks-extra-js/prefer-use-state-lazy-initialization': 'error',

		// react-you-might-not-need-an-effect
		'react-effects-js/no-empty-effect': 'warn',
		'react-effects-js/no-adjust-state-on-prop-change': 'warn',
		'react-effects-js/no-reset-all-state-on-prop-change': 'warn',
		'react-effects-js/no-event-handler': 'warn',
		'react-effects-js/no-pass-live-state-to-parent': 'warn',
		'react-effects-js/no-pass-data-to-parent': 'warn',
		'react-effects-js/no-manage-parent': 'warn',
		'react-effects-js/no-initialize-state': 'warn',
		'react-effects-js/no-chain-state-updates': 'warn',
		'react-effects-js/no-derived-state': 'warn',

		'eslint/no-await-in-loop': 'error',
		'always-return': 'allow',
		'no-array-sort': 'allow',
		'no-new-array': 'allow',
		'style-prop-object': 'allow',
		'no-map-spread': 'allow',
		'no-await-in-loop': 'allow',
	},
	settings: {
		react: {
			version: '19.2',
		},
	},
	jsPlugins: [
		{ name: 'tanstack-query', specifier: '@tanstack/eslint-plugin-query' },
		{ name: 'react-compiler-js', specifier: 'eslint-plugin-react-compiler' },
		{ name: 'bbplayer', specifier: './packages/eslint-plugin/index.js' },
		{
			name: 'react-hooks-extra-js',
			specifier: 'eslint-plugin-react-hooks-extra',
		},
		{
			name: 'react-effects-js',
			specifier: 'eslint-plugin-react-you-might-not-need-an-effect',
		},
		{ name: 'drizzle-js', specifier: 'eslint-plugin-drizzle' },
	],
	overrides: [
		{
			files: ['packages/**/*.{ts,tsx,js,jsx}'],
			rules: {
				'no-console': 'allow',
			},
		},
	],
})
