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
 * 返回 playlist ID；track 数量通过 onSynced 回调交给上层埋点。
 */
export async function persistFavoriteSync(
	deps: Pick<
		FavoriteSyncDeps,
		| 'db'
		| 'playlistService'
		| 'trackService'
		| 'artistService'
		| 'logger'
		| 'onSynced'
	>,
	args: {
		favoriteId: number
		metadata: FavoriteListInfo
		details: FavoriteTrackDetails
		expansion: FavoriteExpansion
	},
): Promise<Result<number, FacadeError>> {
	const { db, playlistService, trackService, artistService, logger, onSynced } =
		deps
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
			logger.debug('step 5: 创建 playlist 和其对应的 author 信息完成', {
				localPlaylistId: playlistResult.value.id,
				artistId: playlistAuthor.value.id,
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
			logger.debug('step 6: 创建 artist 完成', {
				total: artistsMap.value.size,
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
			logger.debug('step 7: 创建或查找 tracks 并获取 uniqueKey->id 映射完成', {
				total: createdTracksMapResult.value.size,
			})

			const orderedUniqueKeysResult = buildFavoriteOrderedUniqueKeys(
				details.orderedBvids,
				expansion.expandedTracksMap,
			)
			if (orderedUniqueKeysResult.isErr()) {
				throw orderedUniqueKeysResult.error
			}
			const orderedUniqueKeys = orderedUniqueKeysResult.value
			logger.debug(
				'step 8: 为远程所有 tracks 生成了其对应的 uniqueKey 顺序列表',
				{
					total: orderedUniqueKeys.length,
				},
			)

			const uniqueKeyToIdMapResult =
				await trackSvc.findTrackIdsByUniqueKeys(orderedUniqueKeys)
			if (uniqueKeyToIdMapResult.isErr()) {
				throw uniqueKeyToIdMapResult.error
			}
			const uniqueKeyToIdMap = uniqueKeyToIdMapResult.value
			logger.debug('step 9: 一次性获取所有 uniqueKey 到本地 ID 的映射完成', {
				total: uniqueKeyToIdMap.size,
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
			logger.debug('step 10: 按 Bilibili 收藏夹顺序重排所有 tracks 完成', {
				total: finalOrderedTrackIds.length,
			})

			const replaceResult = await playlistSvc.replacePlaylistAllTracks(
				playlistResult.value.id,
				finalOrderedTrackIds,
			)
			if (replaceResult.isErr()) {
				throw replaceResult.error
			}
			logger.debug('step 11: 替换 playlist 中所有 tracks 完成')
			logger.info('同步收藏夹完成', {
				remoteId: favoriteId,
				playlistId: playlistResult.value.id,
			})

			onSynced?.(finalOrderedTrackIds.length)

			return playlistResult.value.id
		}),
		(e) =>
			createFacadeError('SyncFavoriteFailed', '同步收藏夹失败', {
				cause: e,
			}),
	)
}
