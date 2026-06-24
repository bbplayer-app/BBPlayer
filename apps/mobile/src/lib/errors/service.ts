import { ServiceError } from './index'
export type ServiceErrorType =
	| 'TrackNotFound'
	| 'ArtistNotFound'
	| 'PlaylistNotFound'
	| 'PlaylistAlreadyExists'
	| 'TrackNotInPlaylist'
	| 'ArtistAlreadyExists'
	| 'Validation'
	| 'NotImplemented'
	| 'FetchDownloadUrlFailed'
	| 'DeleteDownloadRecordFailed'
	| 'SkinFetchFailed'
	| 'SkinValidationFailed'
	| 'SkinDownloadFailed'
	| 'SkinTransformFailed'
	| 'SkinInstallFailed'
	| 'SkinUninstallFailed'
	| 'SkinNotFound'

export function createServiceError(
	type: ServiceErrorType,
	message: string,
	options?: { data?: unknown; cause?: unknown },
) {
	return new ServiceError(message, {
		type,
		data: options?.data,
		cause: options?.cause,
	})
}

export function createTrackNotFound(trackId: number | string, cause?: unknown) {
	return createServiceError('TrackNotFound', `未找到 track ${trackId}`, {
		data: { trackId },
		cause,
	})
}

export function createArtistNotFound(
	artistId: number | string,
	cause?: unknown,
) {
	return createServiceError('ArtistNotFound', `未找到 artist ${artistId}`, {
		data: { artistId },
		cause,
	})
}

export function createPlaylistNotFound(
	playlistId: number | string,
	cause?: unknown,
) {
	return createServiceError(
		'PlaylistNotFound',
		`未找到 playlist ${playlistId}`,
		{ data: { playlistId }, cause },
	)
}

export function createTrackNotInPlaylist(
	trackId: number | string,
	playlistId: number | string,
	cause?: unknown,
) {
	return createServiceError(
		'TrackNotInPlaylist',
		`track ${trackId} 不在 playlist ${playlistId} 中`,
		{
			data: { trackId, playlistId },
			cause,
		},
	)
}

export function createValidationError(
	message = '参数校验失败',
	cause?: unknown,
) {
	return createServiceError('Validation', message, { cause })
}

export function createNotImplementedError(message = '未实现', cause?: unknown) {
	return createServiceError('NotImplemented', message, { cause })
}

export function createPlaylistAlreadyExists(title: string, cause?: unknown) {
	return createServiceError(
		'PlaylistAlreadyExists',
		`播放列表 "${title}" 已存在`,
		{
			data: { title },
			cause,
		},
	)
}

export { DatabaseError } from './index'

export function createSkinFetchFailed(
	message = '获取装扮资源失败',
	cause?: unknown,
) {
	return createServiceError('SkinFetchFailed', message, { cause })
}

export function createSkinValidationFailed(
	message = '装扮数据校验失败',
	cause?: unknown,
) {
	return createServiceError('SkinValidationFailed', message, { cause })
}

export function createSkinDownloadFailed(
	message = '下载装扮资源失败',
	cause?: unknown,
) {
	return createServiceError('SkinDownloadFailed', message, { cause })
}

export function createSkinTransformFailed(
	message = '装扮资源转换失败',
	cause?: unknown,
) {
	return createServiceError('SkinTransformFailed', message, { cause })
}

export function createSkinInstallFailed(
	message = '安装装扮失败',
	cause?: unknown,
) {
	return createServiceError('SkinInstallFailed', message, { cause })
}

export function createSkinUninstallFailed(
	message = '卸载装扮失败',
	cause?: unknown,
) {
	return createServiceError('SkinUninstallFailed', message, { cause })
}

export function createSkinNotFound(skinId: string, cause?: unknown) {
	return createServiceError('SkinNotFound', `未找到装扮 ${skinId}`, {
		data: { skinId },
		cause,
	})
}
