module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// scope 必须是以下之一
		'scope-enum': [
			2, // 错误级别：2=error
			'always', // 必须匹配
			['app', 'docs', 'eitc', 'orpheus', 'root'], // 允许的 scope
		],
		// 允许空 scope（可选，如果需要强制写 scope，改成 2）
		'scope-empty': [0, 'never'],
	},
}
