import useAppStore from '@/hooks/stores/useAppStore'

/**
 * 上报 Sentry 前抹掉能关联到具体账号、设备或 IP 的字段。
 *
 * 歌名、BV 号等播放记录保留：它们是排查问题需要的，只要不能和账号关联起来就没有意义。
 * 字段规则与原生侧的 `TelemetryScrubber.kt`（packages/native）保持一致。
 */

const REDACTED = '[redacted]'

// B 站登录凭据、账号 id（mid）、设备标识（buvid）以及 CDN 链接里的签名和客户端 IP（oi）
const SENSITIVE_KEYS =
	'SESSDATA|bili_jct|DedeUserID(?:__ckMd5)?|sid|buvid[34]?|b_nut|bili_ticket|ac_time_value|' +
	'access_key|access_token|refresh_token|csrf|(?:up_|v)?mid|upsig|oi'

const SENSITIVE_KEY_REGEX = new RegExp(
	`^(?:${SENSITIVE_KEYS}|cookie|set-cookie|authorization)$`,
	'i',
)

// 查询参数与 cookie 里的 key=value
const PAIR_REGEX = new RegExp(
	`(^|[^\\w-])(${SENSITIVE_KEYS})=([^&;\\s"'<>]+)`,
	'gi',
)

// JSON 或对象打印里的 "key": value
const FIELD_REGEX = new RegExp(
	`(^|[^\\w-])(["']?)(${SENSITIVE_KEYS})\\2(\\s*:\\s*)("[^"]*"|'[^']*'|[^,}\\s]+)`,
	'gi',
)

// 请求头整行
const HEADER_REGEX =
	/\b(cookie|set-cookie|authorization)\b(["']?\s*[:=]\s*)[^\n]+/gi

const MAX_DEPTH = 6

/** 当前登录账号的 mid：queryKey、错误信息里可能以裸数字出现，按字段名匹配不到 */
function getOwnMidRegex(): RegExp | null {
	const mid = useAppStore.getState().bilibiliCookie?.DedeUserID

	if (!mid || !/^\d{3,}$/.test(mid)) return null

	return new RegExp(`(^|\\D)${mid}(?=\\D|$)`, 'g')
}

function scrubTextWith(text: string, ownMid: RegExp | null): string {
	if (!text) return text

	let result = text
		.replace(
			HEADER_REGEX,
			(_, name: string, sep: string) => `${name}${sep}${REDACTED}`,
		)
		.replace(
			PAIR_REGEX,
			(_, prefix: string, key: string) => `${prefix}${key}=${REDACTED}`,
		)
		.replace(
			FIELD_REGEX,
			(_, prefix: string, quote: string, key: string, sep: string) =>
				`${prefix}${quote}${key}${quote}${sep}"${REDACTED}"`,
		)

	if (ownMid) {
		result = result.replace(
			ownMid,
			(_, prefix: string) => `${prefix}${REDACTED}`,
		)
	}

	return result
}

/* oxlint-disable anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, anti-slop/no-known-value-widening -- 输入是 Sentry 事件和日志里任意形状的数据，这里是它们离开设备前的最后一道边界，只能按运行时类型逐个处理 */
function scrubValueWith(
	value: unknown,
	ownMid: RegExp | null,
	depth: number,
): unknown {
	if (typeof value === 'string') return scrubTextWith(value, ownMid)

	if (typeof value === 'number' && ownMid) {
		return scrubTextWith(String(value), ownMid) === String(value)
			? value
			: REDACTED
	}

	if (value === null || typeof value !== 'object' || depth >= MAX_DEPTH) {
		return value
	}

	if (Array.isArray(value)) {
		return value.map((item) => scrubValueWith(item, ownMid, depth + 1))
	}

	const result: Record<string, unknown> = {}

	for (const [key, item] of Object.entries(value)) {
		result[key] = SENSITIVE_KEY_REGEX.test(key)
			? REDACTED
			: scrubValueWith(item, ownMid, depth + 1)
	}

	return result
}
/* oxlint-enable anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, anti-slop/no-known-value-widening */

export function scrubText(text: string): string {
	return scrubTextWith(text, getOwnMidRegex())
}

/** 递归处理对象：敏感字段名的值直接替换，字符串按规则脱敏 */
export function scrubValue<T>(value: T): T {
	// SAFETY: scrubValueWith 只替换字符串和敏感字段的值，不改变对象结构
	return scrubValueWith(value, getOwnMidRegex(), 0) as T
}
