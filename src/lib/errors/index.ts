import { Data } from 'effect'

interface BaseErrorPayload {
	readonly message: string
	readonly cause?: unknown
	readonly data?: unknown
}

export class TransactionFailedError extends Data.TaggedError(
	'TransactionFailedError',
)<BaseErrorPayload> {}

export class UIError extends Data.TaggedError('UIError')<BaseErrorPayload> {}

export class ThirdPartyError extends Data.TaggedError('ThirdPartyError')<
	BaseErrorPayload & { readonly vendor: string }
> {}

export class DatabaseError extends Data.TaggedError(
	'DatabaseError',
)<BaseErrorPayload> {}

export class DataParsingError extends Data.TaggedError(
	'DataParsingError',
)<BaseErrorPayload> {}

export class FileSystemError extends Data.TaggedError(
	'FileSystemError',
)<BaseErrorPayload> {}

export class LrcParseError extends Data.TaggedError('LrcParseError')<
	Omit<BaseErrorPayload, 'data'>
> {}

export type AppError =
	| UIError
	| ThirdPartyError
	| DatabaseError
	| DataParsingError
	| FileSystemError
	| LrcParseError
