export default (api) => {
	api.cache(true)
	return {
		presets: [['babel-preset-expo']],
		env: {
			production: {
				plugins: ['react-native-paper/babel', 'transform-remove-console'],
			},
		},
		plugins: [
			[
				'babel-plugin-react-compiler',
				{
					logLevel: 'verbose',

					logger: {
						logEvent(filename, event) {
							switch (event.kind) {
								case 'CompileSuccess': {
									console.log(`✅ Compiled: ${filename}`)
									break
								}
								case 'CompileError': {
									console.log(
										`❌ Skipped: ${filename} [reason: ${event.detail.reason}] [description: ${event.detail.description}] [loc: ${event.detail.loc.start.line}, ${event.detail.loc.start.column}] [suggestion: ${event.detail.suggestions}]`,
									)
									break
								}
								default: {
								}
							}
						},
					},
				},
			],
			[
				'react-native-boost/plugin',
				{
					ignores: ['node_modules/**', '../../node_modules/**'],
					optimizations: {
						text: true,
						view: true,
					},
					silent: false,
					verbose: true,
				},
			],
			['inline-import', { extensions: ['.sql'] }],
		],
	}
}
