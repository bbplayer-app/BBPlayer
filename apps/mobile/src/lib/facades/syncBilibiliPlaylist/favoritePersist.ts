import { Result, ResultAsync } from 'neverthrow'

import { createFacadeError, type FacadeError } from '@/lib/errors/facade'
import generateUniqueTrackKey from '@/lib/services/genKey'
import type { CreateArtistPayload } from '@/types/services/artist'

import {
	buildFavoriteOrderedUniqueKeys,
	buildFavoriteTrackPayloads,
} from './favoritePlan'
import type {
	FavoriteExpansion,
	FavoriteListInfo,
	FavoriteSyncDeps,
	FavoriteTrackDetails,
} from './types'

/**
 * 阶段 6：落库事务。
 * 创建 playlist/author、批量创建 artists、按顺序创建 tracks、重排并替换。
 * 返回 playlist ID。
 */
export async function persistFavoriteSync(
	deps: Pick<
		FavoriteSyncDeps,
		'db' | 'playlistService' | 'trackService' | 'artistService' | 'logger'
	>,
	args: {
		favoriteId: number
		metadata: FavoriteListInfo
		details: FavoriteTrackDetails
		expansion: FavoriteExpansion
	},
): Promise<Result<number, FacadeError>> {
	const { db, playlistService, trackService, artistService, logger } = deps

	const { favoriteId, metadata, details, expansion } = args

	return ResultAsync.fromPromise(
		db.transaction(async (tx) => {
			const playlistSvc = playlistService.withDB(tx)
			const trackSvc = trackService.withDB(tx)
			const artistSvc = artistService.withDB(tx)

			const playlistAuthor = await artistSvc.findOrCreateArtist({
				name: metadata.upper.name,
				source: 'bilibili',
				remoteId: String(metadata.upper.mid),
				avatarUrl: metadata.upper.face,
			})

			if (playlistAuthor.isErr()) {
				throw playlistAuthor.error
			}

			const playlistResult = await playlistSvc.findOrCreateRemotePlaylist({
				title: metadata.title,
				description: metadata.intro,
				coverUrl: metadata.cover,
				type: 'favorite',
				remoteSyncId: favoriteId,
				authorId: playlistAuthor.value.id,
			})

			if (playlistResult.isErr()) {
				throw playlistResult.error
			}

			logger.debug('bilibili.favorite.playlist_created', {
				'bilibili.local_playlist_id': playlistResult.value.id,
				'bilibili.artist_id': playlistAuthor.value.id,
			})

			const uniqueArtistPayloadsMap = new Map<string, CreateArtistPayload>()

			for (const trackMeta of details.metadata) {
				const remoteId = String(trackMeta.upper.mid)

				if (!uniqueArtistPayloadsMap.has(remoteId)) {
					uniqueArtistPayloadsMap.set(remoteId, {
						name: trackMeta.upper.name,
						source: 'bilibili',
						remoteId: remoteId,
						avatarUrl: trackMeta.upper.face,
					})
				}
			}

			const uniqueArtistPayloads = Array.from(uniqueArtistPayloadsMap.values())

			const artistsMap =
				await artistSvc.findOrCreateManyRemoteArtists(uniqueArtistPayloads)

			if (artistsMap.isErr()) {
				throw artistsMap.error
			}

			logger.debug('bilibili.favorite.artists_created', {
				'bilibili.total': artistsMap.value.size,
			})

			const trackPayloads = buildFavoriteTrackPayloads(
				details.metadata,
				expansion.expandedTracksMap,
				artistsMap.value,
			)

			const trackPayloadsWithKeysResult = Result.combine(
				trackPayloads.map((p) =>
					generateUniqueTrackKey(p).map((uniqueKey) => ({
						payload: p,
						uniqueKey,
					})),
				),
			)

			if (trackPayloadsWithKeysResult.isErr()) {
				throw trackPayloadsWithKeysResult.error
			}

			const trackPayloadsWithKeys = trackPayloadsWithKeysResult.value

			const createdTracksMapResult = await trackSvc.findOrCreateManyTracks(
				trackPayloadsWithKeys.map((p) => p.payload),
				'bilibili',
			)

			if (createdTracksMapResult.isErr()) {
				throw createdTracksMapResult.error
			}

			logger.debug('bilibili.favorite.tracks_resolved', {
				'bilibili.total': createdTracksMapResult.value.size,
			})

			const orderedUniqueKeysResult = buildFavoriteOrderedUniqueKeys(
				details.orderedBvids,
				expansion.expandedTracksMap,
			)

			if (orderedUniqueKeysResult.isErr()) {
				throw orderedUniqueKeysResult.error
			}

			const orderedUniqueKeys = orderedUniqueKeysResult.value
			logger.debug('bilibili.favorite.order_resolved', {
				'bilibili.total': orderedUniqueKeys.length,
			})

			const uniqueKeyToIdMapResult =
				await trackSvc.findTrackIdsByUniqueKeys(orderedUniqueKeys)

			if (uniqueKeyToIdMapResult.isErr()) {
				throw uniqueKeyToIdMapResult.error
			}

			const uniqueKeyToIdMap = uniqueKeyToIdMapResult.value
			logger.debug('bilibili.favorite.ids_resolved', {
				'bilibili.total': uniqueKeyToIdMap.size,
			})

			const finalOrderedTrackIds = orderedUniqueKeys
				.map((key) => uniqueKeyToIdMap.get(key))
				.filter((id) => {
					if (id === undefined)
						throw createFacadeError(
							'SyncFavoriteFailed',
							'已完成 tracks 创建后，却依然没有找到 uniqueKey 对应的 ID',
						)

					return id !== undefined
				})

			logger.debug('bilibili.favorite.order_applied', {
				'bilibili.total': finalOrderedTrackIds.length,
			})

			const replaceResult = await playlistSvc.replacePlaylistAllTracks(
				playlistResult.value.id,
				finalOrderedTrackIds,
			)

			if (replaceResult.isErr()) {
				throw replaceResult.error
			}

			logger.debug('bilibili.favorite.tracks_replaced')
			logger.info('bilibili.favorite.synced', {
				'bilibili.remote_id': favoriteId,
				'playlist.id': playlistResult.value.id,
			})

			return playlistResult.value.id
		}),
		(e) =>
			createFacadeError('SyncFavoriteFailed', '同步收藏夹失败', {
				cause: e,
			}),
	)
}
