module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'scope-enum': [
			2,
			'always',
			['app', 'docs', 'image-colors', 'orpheus', 'root'],
		],
		'scope-empty': [2, 'never'],
	},
}
