import { ThirdPartyError } from '@/lib/errors'

export type BilibiliApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'NoCookie'
	| 'CsrfError'
	| 'AudioStreamError'
	| 'RequestAborted'
	| 'InvalidArgument'

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
	declare readonly type?: BilibiliApiErrorType
	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: BilibiliApiErrorDetails) {
		super(message, {
			vendor: 'Bilibili',
			data: {
				rawData,
				msgCode,
			},
			type,
			cause,
		})
		this.data = {
			rawData,
			msgCode: msgCode ?? 0,
		}
		if (type) this.type = type
	}
}
