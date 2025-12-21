import { Data } from 'effect'

export class TrackNotFoundError extends Data.TaggedError('TrackNotFound')<{
	trackId: number | string
	cause?: unknown
}> {}

export class ArtistNotFoundError extends Data.TaggedError('ArtistNotFound')<{
	artistId: number | string
	cause?: unknown
}> {}

export class PlaylistNotFoundError extends Data.TaggedError(
	'PlaylistNotFound',
)<{
	playlistId: number | string
	cause?: unknown
}> {}

export class PlaylistAlreadyExistsError extends Data.TaggedError(
	'PlaylistAlreadyExists',
)<{
	name?: string
	cause?: unknown
}> {}

export class TrackAlreadyExistsError extends Data.TaggedError(
	'TrackAlreadyExists',
)<{
	trackId: number | string
	cause?: unknown
}> {}

export class ArtistAlreadyExistsError extends Data.TaggedError(
	'ArtistAlreadyExists',
)<{
	remoteId: string
	source: string
	cause?: unknown
}> {}

export class TrackNotInPlaylistError extends Data.TaggedError(
	'TrackNotInPlaylist',
)<{
	trackId: number | string
	playlistId: number | string
	cause?: unknown
}> {}

export class ValidationError extends Data.TaggedError('Validation')<{
	message: string
	cause?: unknown
}> {}

export class NotImplementedError extends Data.TaggedError('NotImplemented')<{
	message: string
	cause?: unknown
}> {}

export class FetchDownloadUrlFailedError extends Data.TaggedError(
	'FetchDownloadUrlFailed',
)<{
	trackId: number | string
	cause?: unknown
}> {}

export class DeleteDownloadRecordFailedError extends Data.TaggedError(
	'DeleteDownloadRecordFailed',
)<{
	trackId: number | string
	cause?: unknown
}> {}

export type ServiceError =
	| TrackNotFoundError
	| ArtistNotFoundError
	| PlaylistNotFoundError
	| PlaylistAlreadyExistsError
	| TrackAlreadyExistsError
	| ArtistAlreadyExistsError
	| TrackNotInPlaylistError
	| ValidationError
	| NotImplementedError
	| FetchDownloadUrlFailedError
	| DeleteDownloadRecordFailedError
