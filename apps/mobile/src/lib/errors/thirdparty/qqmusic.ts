import { ThirdPartyError } from '@/lib/errors'

export type QQMusicApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'ValidationFailed'

interface QQMusicApiErrorDetails {
	message: string
	msgCode?: number
	rawData?: unknown
	type?: QQMusicApiErrorType
	cause?: unknown
}

interface QQMusicErrorData {
	msgCode: number
	rawData: unknown
}

export class QQMusicApiError extends ThirdPartyError {
	readonly data: QQMusicErrorData
	readonly type?: QQMusicApiErrorType
	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: QQMusicApiErrorDetails) {
		super(message, {
			vendor: 'QQMusic',
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
