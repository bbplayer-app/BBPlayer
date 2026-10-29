import { ThirdPartyError } from '@/lib/errors'

export type BilibiliApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'RateLimited'
	| 'NoCookie'
	| 'CsrfError'
	| 'AudioStreamError'
	| 'RequestAborted'
	| 'InvalidArgument'

export const BILIBILI_RATE_LIMIT_CODES = new Set([412, -412, 429, -429, -509])

const RATE_LIMIT_MESSAGE_PATTERN =
	/\b(412|429)\b|请求过于频繁|请求被拦截|触发风控|too many requests|precondition failed|rate[\s_-]*limit/i

export function isBilibiliRateLimitError(error: unknown): boolean {
	if (!error) return false

	if (error instanceof BilibiliApiError) {
		if (error.type === 'RateLimited') return true
		if (BILIBILI_RATE_LIMIT_CODES.has(error.data.msgCode)) return true
		if (RATE_LIMIT_MESSAGE_PATTERN.test(error.message)) return true
		return false
	}

	if (typeof error === 'object') {
		const record = error as Record<string, unknown>
		if (record.type === 'RateLimited') return true

		const codeCandidates = [
			record.msgCode,
			record.status,
			record.statusCode,
			record.code,
			typeof record.data === 'object' && record.data !== null
				? (record.data as Record<string, unknown>).msgCode
				: undefined,
		]
		for (const code of codeCandidates) {
			if (typeof code === 'number' && BILIBILI_RATE_LIMIT_CODES.has(code)) {
				return true
			}
		}

		if (
			typeof record.message === 'string' &&
			RATE_LIMIT_MESSAGE_PATTERN.test(record.message)
		) {
			return true
		}
	}

	if (
		error instanceof Error &&
		RATE_LIMIT_MESSAGE_PATTERN.test(error.message)
	) {
		return true
	}

	return false
}

interface BilibiliApiErrorDetails {
	message: string
	msgCode?: number
	rawData?: unknown
	type?: BilibiliApiErrorType
	cause?: unknown
}

interface BilibiliErrorData {
	msgCode: number
	rawData: unknown
}

export class BilibiliApiError extends ThirdPartyError {
	readonly data: BilibiliErrorData
	readonly type?: BilibiliApiErrorType
	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: BilibiliApiErrorDetails) {
		super(message, {
			vendor: 'Bilibili',
			type,
			data: {
				rawData,
				msgCode,
			},
			cause,
		})
		this.data = {
			rawData,
			msgCode: msgCode ?? 0,
		}
		this.type = type
	}
}
