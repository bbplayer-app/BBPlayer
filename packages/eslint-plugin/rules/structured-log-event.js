const levels = new Set(['debug', 'info', 'warning', 'error'])
const eventPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/

export default {
	meta: {
		type: 'problem',
		docs: { description: 'Keep mobile log event names stable and queryable' },
		schema: [],
		messages: {
			event:
				'日志事件必须是固定的 domain.action 字符串；动态值请放入结构化属性。',
		},
	},
	createOnce(context) {
		const loggers = new Set()
		const isLogger = (node) => {
			if (node.type === 'Identifier') return loggers.has(node.name)
			if (node.type === 'MemberExpression') {
				return (
					!node.computed &&
					node.property.name === 'logger' &&
					node.object.type === 'Identifier' &&
					node.object.name === 'deps'
				)
			}
			return (
				node.type === 'CallExpression' &&
				node.callee.type === 'MemberExpression' &&
				node.callee.property.name === 'extend' &&
				isLogger(node.callee.object)
			)
		}
		return {
			// createOnce 只调用一次，每个文件开始前清空上一个文件收集到的 logger
			before() {
				loggers.clear()
			},
			ImportDeclaration(node) {
				if (!/(?:^|\/)utils\/log$/.test(node.source.value)) return
				for (const specifier of node.specifiers) {
					if (specifier.type === 'ImportDefaultSpecifier') {
						loggers.add(specifier.local.name)
					}
				}
			},
			VariableDeclarator(node) {
				if (node.id.type === 'Identifier' && node.init && isLogger(node.init)) {
					loggers.add(node.id.name)
				}
			},
			// 同步阶段通过 SyncLogger 参数注入日志入口。
			FunctionDeclaration(node) {
				for (const param of node.params) {
					if (
						param.type === 'Identifier' &&
						param.name === 'logger' &&
						param.typeAnnotation?.typeAnnotation?.typeName?.name ===
							'SyncLogger'
					) {
						loggers.add(param.name)
					}
				}
			},
			CallExpression(node) {
				const callee = node.callee
				if (
					callee.type !== 'MemberExpression' ||
					callee.computed ||
					!levels.has(callee.property.name) ||
					!isLogger(callee.object)
				)
					return
				const event = node.arguments[0]
				if (
					event?.type !== 'Literal' ||
					typeof event.value !== 'string' ||
					!eventPattern.test(event.value)
				) {
					context.report({ node: event ?? node, messageId: 'event' })
				}
			},
		}
	},
}
