// 本地实现的 prefer-alias，替代 @dword-design/eslint-plugin-import-alias。
//
// 原插件加载时会引入 typescript 和 @babel/core（约 650ms），并且默认对每个文件
// 读取 Babel 配置和 tsconfig；我们只用到“显式 alias + aliasForSubpaths: true”
// 这一种用法，所以只实现这部分：把指向 alias 目录内的父级相对导入改写为 alias。
//
// 与原插件的差异：判断导入是否落在 alias 目录内时按路径段匹配，不再是字符串前缀
// 匹配（原插件会把 `apps/mobile/srcfoo` 误判为在 `apps/mobile/src` 内）。
import path from 'node:path'

import { eslintCompatPlugin } from '@oxlint/plugins'

/** `../x`、`./../x` 视为父级导入（与原插件 is-parent-import 一致）。 */
function isParentImport(sourcePath) {
	const segments = sourcePath.split('/')

	if (segments[0] === '.') segments.shift()

	return segments[0] === '..'
}

function isInside(target, directory) {
	const relative = path.relative(directory, target)

	return (
		relative === '' ||
		(relative !== '..' &&
			!relative.startsWith(`..${path.sep}`) &&
			!path.isAbsolute(relative))
	)
}

const preferAliasRule = {
	meta: {
		type: 'suggestion',
		fixable: 'code',
		docs: {
			description:
				'Enforce usage of import aliases over relative parent imports',
		},
		messages: {
			parentImport:
				"Unexpected parent import '{{sourcePath}}'. Use '{{rewrittenImport}}' instead",
		},
		schema: [
			{
				type: 'object',
				properties: {
					alias: {
						type: 'object',
						additionalProperties: { type: 'string' },
					},
				},
				required: ['alias'],
				additionalProperties: false,
			},
		],
	},
	createOnce(context) {
		/** 按目录深度从深到浅排序，优先匹配最具体的 alias。 */
		let aliases = []
		let aliasesKey = null

		return {
			before() {
				if (context.filename === '<text>') return false
				const alias = context.options[0]?.alias ?? {}
				// options 与 cwd 在一次 lint 中基本不变，按内容缓存，避免每个文件重复计算。
				const key = `${context.cwd}\0${JSON.stringify(alias)}`

				if (key !== aliasesKey) {
					aliasesKey = key
					aliases = Object.entries(alias)
						.map(([name, target]) => ({
							name,
							directory: path.resolve(context.cwd, target),
						}))
						.sort(
							(a, b) =>
								b.directory.split(path.sep).length -
								a.directory.split(path.sep).length,
						)
				}

				if (aliases.length === 0) return false
			},
			ImportDeclaration(node) {
				const sourcePath = node.source.value

				if (!isParentImport(sourcePath)) return

				const absoluteImportPath = path.resolve(
					path.dirname(context.filename),
					sourcePath,
				)

				const match = aliases.find(({ directory }) =>
					isInside(absoluteImportPath, directory),
				)

				if (!match) return

				const relativePath = path
					.relative(match.directory, absoluteImportPath)
					.replaceAll('\\', '/')

				const rewrittenImport = relativePath
					? `${match.name}/${relativePath}`
					: match.name

				context.report({
					node,
					messageId: 'parentImport',
					data: { sourcePath, rewrittenImport },
					fix: (fixer) =>
						fixer.replaceTextRange(
							[node.source.range[0] + 1, node.source.range[1] - 1],
							rewrittenImport,
						),
				})
			},
		}
	},
}

export default eslintCompatPlugin({
	meta: { name: 'import-alias' },
	rules: {
		'prefer-alias': preferAliasRule,
	},
})
