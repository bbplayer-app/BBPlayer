module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'scope-enum': [
			2,
			'always',
			['mobile', 'docs', 'image-colors', 'orpheus', 'logs', 'root'],
		],
		'scope-empty': [2, 'never'],
	},
}
