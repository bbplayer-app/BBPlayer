import { Data } from 'effect'

export class BilibiliRequestFailedError extends Data.TaggedError(
	'BilibiliRequestFailed',
)<{
	message: string
	cause?: unknown
	msgCode?: number
}> {
	readonly vendor = 'Bilibili'
}

export class BilibiliRequestAbortedError extends Data.TaggedError(
	'BilibiliRequestAborted',
)<{
	message?: string
	cause?: unknown
}> {
	readonly vendor = 'Bilibili'
}

export class BilibiliResponseFailedError extends Data.TaggedError(
	'BilibiliResponseFailed',
)<{
	message: string
	msgCode: number
	rawData?: unknown
	cause?: unknown
}> {
	readonly vendor = 'Bilibili'
}

export class BilibiliNoCookieError extends Data.TaggedError(
	'BilibiliNoCookie',
)<{
	message?: string
	cause?: unknown
}> {
	readonly vendor = 'Bilibili'
}

export class BilibiliCsrfError extends Data.TaggedError('BilibiliCsrfError')<{
	message?: string
	rawData?: unknown
	cause?: unknown
}> {
	readonly vendor = 'Bilibili'
}

export class BilibiliInvalidArgumentError extends Data.TaggedError(
	'BilibiliInvalidArgument',
)<{
	message: string
	rawData?: unknown
}> {
	readonly vendor = 'Bilibili'
}

export class BilibiliAudioStreamError extends Data.TaggedError(
	'BilibiliAudioStreamError',
)<{
	message: string
	msgCode?: number
	cause?: unknown
}> {
	readonly vendor = 'Bilibili'
}

export type BilibiliApiError =
	| BilibiliRequestFailedError
	| BilibiliRequestAbortedError
	| BilibiliResponseFailedError
	| BilibiliNoCookieError
	| BilibiliCsrfError
	| BilibiliInvalidArgumentError
	| BilibiliAudioStreamError
