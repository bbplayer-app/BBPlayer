import { Data } from 'effect'

export class SyncTaskAlreadyRunningError extends Data.TaggedError(
	'SyncTaskAlreadyRunning',
)<{
	cause?: unknown
}> {}

export class SyncCollectionFailedError extends Data.TaggedError(
	'SyncCollectionFailed',
)<{
	message?: string
	cause?: unknown
}> {}

export class SyncMultiPageFailedError extends Data.TaggedError(
	'SyncMultiPageFailed',
)<{
	pageIndex?: number
	message?: string
	cause?: unknown
}> {}

export class SyncFavoriteFailedError extends Data.TaggedError(
	'SyncFavoriteFailed',
)<{
	userId?: string | number
	cause?: unknown
}> {}

export class FetchRemotePlaylistMetadataFailedError extends Data.TaggedError(
	'FetchRemotePlaylistMetadataFailed',
)<{
	source?: string
	remoteId?: string
	cause?: unknown
}> {}

export class PlaylistDuplicateFailedError extends Data.TaggedError(
	'PlaylistDuplicateFailed',
)<{
	playlistName?: string
	cause?: unknown
}> {}

export class UpdateTrackLocalPlaylistsFailedError extends Data.TaggedError(
	'UpdateTrackLocalPlaylistsFailed',
)<{
	trackId?: number | string
	cause?: unknown
}> {}

export class BatchAddTracksToLocalPlaylistFailedError extends Data.TaggedError(
	'BatchAddTracksToLocalPlaylistFailed',
)<{
	playlistId?: number | string
	failedTrackIds?: (number | string)[]
	cause?: unknown
}> {}

export type FacadeError =
	| SyncTaskAlreadyRunningError
	| SyncCollectionFailedError
	| SyncMultiPageFailedError
	| SyncFavoriteFailedError
	| FetchRemotePlaylistMetadataFailedError
	| PlaylistDuplicateFailedError
	| UpdateTrackLocalPlaylistsFailedError
	| BatchAddTracksToLocalPlaylistFailedError
