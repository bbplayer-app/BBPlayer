import { Data } from 'effect'

export class NeteaseRequestFailedError extends Data.TaggedError(
	'NeteaseRequestFailed',
)<{
	message: string
	cause?: unknown
}> {
	readonly vendor = 'Netease'
}

export class NeteaseResponseFailedError extends Data.TaggedError(
	'NeteaseResponseFailed',
)<{
	message: string
	msgCode: number
	rawData?: unknown
	cause?: unknown
}> {
	readonly vendor = 'Netease'
}

export class NeteaseSearchResultNoMatchError extends Data.TaggedError(
	'NeteaseSearchResultNoMatch',
)<{
	message?: string
	searchKeyword?: string
	cause?: unknown
}> {
	readonly vendor = 'Netease'
}

export type NeteaseApiError =
	| NeteaseRequestFailedError
	| NeteaseResponseFailedError
	| NeteaseSearchResultNoMatchError
