import { ThirdPartyError } from '@/lib/errors'

export type KugouApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'ValidationFailed'

interface KugouApiErrorDetails {
	message: string
	msgCode?: number
	rawData?: unknown
	type?: KugouApiErrorType
	cause?: unknown
}

interface KugouErrorData {
	msgCode: number
	rawData: unknown
}

export class KugouApiError extends ThirdPartyError {
	readonly data: KugouErrorData
	readonly type?: KugouApiErrorType
	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: KugouApiErrorDetails) {
		super(message, {
			vendor: 'Kugou',
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
