import { Data } from 'effect'

export class PlayerUnknownSourceError extends Data.TaggedError(
	'PlayerUnknownSourceError',
)<{
	source: string
	cause?: unknown
}> {}

export class PlayerAudioUrlNotFoundError extends Data.TaggedError(
	'PlayerAudioUrlNotFoundError',
)<{
	source: string
	cause?: unknown
}> {}
