import type { Event } from '@sentry/react-native'

type ExceptionValue = NonNullable<
	NonNullable<Event['exception']>['values']
>[number]

const NATIVE_MODULE_CALL_RE = /^Call to function '([^']+)' has been rejected\./
const CAUSE_SEPARATOR = '\n→ Caused by: '
const NAMED_EXCEPTION_RE = /^([\w$]+(?:\.[\w$]+)*(?:Exception|Error))\b/

function normalizeCauseText(text: string): string {
	return text
		.replace(/\b\d+\b/g, '#')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 120)
}

function getCauseKey(value: ExceptionValue): string | undefined {
	if (value.type) {
		return value.type
	}

	if (!value.value) {
		return undefined
	}

	// 形如 kotlin.TypeCastException: ... / java.lang.SecurityException
	const namedException = NAMED_EXCEPTION_RE.exec(value.value)?.[1]

	return namedException ?? normalizeCauseText(value.value)
}

function getRootCause(
	values: ExceptionValue[] | undefined,
): ExceptionValue | undefined {
	const primary = values?.[0]

	if (!primary) {
		return undefined
	}

	// Expo 的 CodedException 会把整条 cause 链拼进 message，
	// 最后一段就是最深层根因
	const chain = primary.value?.split(CAUSE_SEPARATOR)
	const deepest = chain?.at(-1)

	if (chain && chain.length > 1 && deepest) {
		return { value: deepest }
	}

	// 其他上报路径可能把 cause 作为额外的 exception value 追加
	for (let index = (values?.length ?? 0) - 1; index > 0; index -= 1) {
		if (values?.[index].value !== primary.value) {
			return values?.[index]
		}
	}

	return undefined
}

/**
 * Expo 原生模块的 Promise 拒绝会在 expo-modules-core 的 CodedError
 * 构造函数里重新创建，栈里只剩构造函数这一帧，Sentry 无法据此区分，
 * 于是把所有原生错误都聚合到同一个 issue 下。
 *
 * 这里按「原生函数名 + 最深层根因」生成指纹，让不同模块、不同失败
 * 原因分别成组。数字会被归一化，避免同一种错误因参数不同而发散。
 */
export function getNativeModuleFingerprint(event: Event): string[] | undefined {
	const values = event.exception?.values
	const primary = values?.[0]
	const call = NATIVE_MODULE_CALL_RE.exec(primary?.value ?? '')

	if (!call) {
		return undefined
	}

	const fingerprint = ['native-module-error', call[1]]
	const rootCause = getRootCause(values)
	const causeKey = rootCause ? getCauseKey(rootCause) : undefined

	if (causeKey) {
		fingerprint.push(causeKey)
	}

	return fingerprint
}
