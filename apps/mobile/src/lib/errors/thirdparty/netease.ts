import { ThirdPartyError } from '@/lib/errors'

export type NeteaseApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'SearchResultNoMatch'

interface NeteaseApiErrorDetails {
	message: string
	msgCode?: number | undefined
	rawData?: unknown
	type?: NeteaseApiErrorType | undefined
	cause?: unknown
}

interface NeteaseErrorData {
	msgCode: number
	rawData: unknown
}

export class NeteaseApiError extends ThirdPartyError {
	readonly data: NeteaseErrorData
	declare readonly type?: NeteaseApiErrorType | undefined
	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: NeteaseApiErrorDetails) {
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
