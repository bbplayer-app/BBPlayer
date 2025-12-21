import { bilibiliApi } from '@/lib/api/bilibili/api'
import { av2bv, bv2av } from '@/lib/api/bilibili/utils'
import { DrizzleDB } from '@/lib/db/db'
import type { DatabaseError, TransactionFailedError } from '@/lib/errors'
import {
	SyncCollectionFailedError,
	SyncFavoriteFailedError,
	SyncMultiPageFailedError,
	SyncTaskAlreadyRunningError,
	type FacadeError,
} from '@/lib/errors/facade'
import type { ServiceError } from '@/lib/errors/service'
import { ValidationError } from '@/lib/errors/service'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { ArtistService } from '@/lib/services/artistService'
import generateUniqueTrackKey from '@/lib/services/genKey'
import { PlaylistService } from '@/lib/services/playlistService'
import { TrackService } from '@/lib/services/trackService'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import type { BilibiliTrack, Playlist, Track } from '@/types/core/media'
import type { CreateArtistPayload } from '@/types/services/artist'
import log from '@/utils/log'
import { diffSets } from '@/utils/set'
import toast from '@/utils/toast'
import { Context, Effect, Layer, Runtime } from 'effect'

let logger = log.extend('Facade')

export interface SyncFacadeSignature {
	readonly addTrackFromBilibiliApi: (
		bvid: string,
		cid?: number,
	) => Effect.Effect<Track, BilibiliApiError | DatabaseError | ServiceError>

	readonly addTrackToLocal: (
		track: Track,
	) => Effect.Effect<Track, DatabaseError | ServiceError | ValidationError>

	readonly syncCollection: (
		collectionId: number,
	) => Effect.Effect<
		number,
		BilibiliApiError | FacadeError | TransactionFailedError | ServiceError
	>

	readonly syncMultiPageVideo: (
		bvid: string,
	) => Effect.Effect<
		number,
		BilibiliApiError | FacadeError | TransactionFailedError | ServiceError
	>

	readonly syncFavorite: (
		favoriteId: number,
	) => Effect.Effect<
		number | undefined,
		| FacadeError
		| BilibiliApiError
		| SyncTaskAlreadyRunningError
		| DatabaseError
		| TransactionFailedError
		| ServiceError
	>

	readonly sync: (
		remoteSyncId: number,
		type: Playlist['type'],
	) => Effect.Effect<
		number | undefined,
		| FacadeError
		| BilibiliApiError
		| SyncTaskAlreadyRunningError
		| DatabaseError
		| TransactionFailedError
		| ServiceError
	>
}

export class SyncFacade extends Context.Tag('SyncFacade')<
	SyncFacade,
	SyncFacadeSignature
>() {}

export const SyncFacadeLive = Layer.effect(
	SyncFacade,
	Effect.gen(function* () {
		const trackService = yield* TrackService
		const playlistService = yield* PlaylistService
		const artistService = yield* ArtistService
		const db = yield* DrizzleDB
		const runtime = yield* Effect.runtime()

		const syncingIds = new Set<string>()

		const runInTransactionPreservingError = <A, E>(
			effect: Effect.Effect<A, E>,
		): Effect.Effect<A, E> => {
			return Effect.tryPromise({
				try: () =>
					db.transaction(async (tx) => {
						const runnable = effect.pipe(
							Effect.provideService(DrizzleDB, tx as unknown as typeof db),
						)
						return Runtime.runPromise(runtime)(runnable)
					}),
				catch: (e) => {
					return e as E
				},
			})
		}

		const addTrackFromBilibiliApi = (bvid: string, cid?: number) =>
			Effect.gen(function* () {
				logger.info('开始添加 Track（Bilibili）', { bvid, cid })
				const data = yield* bilibiliApi.getVideoDetails(bvid)
				const trackPayload = {
					title: data.title,
					source: 'bilibili' as const,
					bilibiliMetadata: {
						bvid,
						cid,
						isMultiPage: cid !== undefined,
						videoIsValid: true,
					},
					coverUrl: data.pic,
					duration: data.duration,
					artist: {
						id: data.owner.mid,
						name: data.owner.name,
						source: 'bilibili' as const,
					},
				}

				return yield* trackService.findOrCreateTrack(trackPayload).pipe(
					Effect.tap((track) =>
						Effect.sync(() => {
							logger.info('添加 Track 成功', {
								trackId: track.id,
								title: track.title,
								source: track.source,
							})
						}),
					),
				)
			})

		const addTrackToLocal = (track: Track) =>
			Effect.gen(function* () {
				if (!track.artist) {
					return yield* new ValidationError({ message: 'artist 不存在' })
				}
				const artist = yield* artistService.findOrCreateArtist({
					name: track.artist.name,
					source: track.artist.source,
					remoteId: track.artist.remoteId,
					avatarUrl: track.artist.avatarUrl,
					signature: track.artist.signature,
				})
				return yield* trackService.findOrCreateTrack({
					...track,
					artistId: artist.id,
				})
			})

		const syncCollection = (collectionId: number) =>
			Effect.gen(function* () {
				const syncKey = `collection::${collectionId}`
				if (syncingIds.has(syncKey)) {
					logger.info('已有同步任务在进行，跳过', {
						type: 'collection',
						id: collectionId,
					})
					return yield* new SyncTaskAlreadyRunningError()
				}

				try {
					syncingIds.add(syncKey)
					logger = log.extend('[Facade/SyncCollection: ' + collectionId + ']')
					logger.info('开始同步合集', { collectionId })
					logger.debug('syncCollection', { collectionId })

					const contents = yield* bilibiliApi
						.getCollectionAllContents(collectionId)
						.pipe(
							Effect.tap(() =>
								Effect.sync(() =>
									logger.debug(
										'step 1: 调用 bilibiliapi getCollectionAllContents 完成',
									),
								),
							),
						)

					logger.info('获取合集详情成功', {
						title: contents.info.title,
						total: contents.medias?.length ?? 0,
					})
					const medias = contents.medias ?? []
					if (medias.length === 0) {
						return yield* new SyncCollectionFailedError({
							message: '同步合集失败，该合集中没有任何 track',
						})
					}

					const transactionEffect = Effect.gen(function* () {
						const playlistArtist = yield* artistService.findOrCreateArtist({
							name: contents.info.upper.name,
							source: 'bilibili',
							remoteId: String(contents.info.upper.mid),
						})

						const playlist = yield* playlistService.findOrCreateRemotePlaylist({
							title: contents.info.title,
							description: contents.info.intro,
							coverUrl: contents.info.cover,
							type: 'collection',
							remoteSyncId: collectionId,
							authorId: playlistArtist.id,
						})
						logger.debug('step 2: 创建 playlist 和其对应的 artist 信息完成', {
							id: playlist.id,
						})

						const uniqueArtists = new Map<number, { name: string }>()
						for (const media of medias) {
							if (!uniqueArtists.has(media.upper.mid)) {
								uniqueArtists.set(media.upper.mid, {
									name: media.upper.name,
								})
							}
						}

						const localArtistIdMap =
							yield* artistService.findOrCreateManyRemoteArtists(
								Array.from(uniqueArtists, ([remoteId, artistInfo]) => ({
									name: artistInfo.name,
									source: 'bilibili',
									remoteId: String(remoteId),
									avatarUrl: undefined,
								})),
							)
						logger.debug('step 3: 创建 artist 完成', {
							uniqueCount: uniqueArtists.size,
						})

						const tracksCreateResult =
							yield* trackService.findOrCreateManyTracks(
								medias.map((v) => ({
									title: v.title,
									source: 'bilibili',
									bilibiliMetadata: {
										bvid: v.bvid,
										isMultiPage: false,
										cid: undefined,
										videoIsValid: true,
									},
									coverUrl: v.cover,
									duration: v.duration,
									artistId: localArtistIdMap.get(String(v.upper.mid))?.id,
								})),
								'bilibili',
							)
						const trackIds = Array.from(tracksCreateResult.values())
						logger.debug('step 4: 创建 tracks 完成', {
							total: trackIds.length,
						})

						yield* playlistService.replacePlaylistAllTracks(
							playlist.id,
							trackIds,
						)
						logger.debug('step 5: 替换 playlist 中所有 tracks 完成')
						logger.info('同步合集完成', {
							remoteId: contents.info.id,
							playlistId: playlist.id,
						})
						return playlist.id
					}).pipe(
						Effect.mapError(
							(e) =>
								new SyncCollectionFailedError({
									message: '同步合集失败',
									cause: e,
								}),
						),
					)

					return yield* runInTransactionPreservingError(transactionEffect)
				} finally {
					syncingIds.delete(syncKey)
				}
			})

		const syncMultiPageVideo = (bvid: string) =>
			Effect.gen(function* () {
				const syncKey = `multiPage::${bvid}`
				if (syncingIds.has(syncKey)) {
					logger.info('已有同步任务在进行，跳过', {
						type: 'multi_page',
						bvid,
					})
					return yield* new SyncTaskAlreadyRunningError()
				}
				try {
					syncingIds.add(syncKey)
					logger = log.extend('[Facade/SyncMultiPageVideo: ' + bvid + ']')
					logger.info('开始同步多集视频', { bvid })

					const data = yield* bilibiliApi
						.getVideoDetails(bvid)
						.pipe(
							Effect.tap(() =>
								Effect.sync(() =>
									logger.debug('step 1: 调用 bilibiliapi getVideoDetails 完成'),
								),
							),
						)

					logger.info('获取多集视频详情成功', {
						title: data.title,
						pages: data.pages.length,
					})

					const transactionEffect = Effect.gen(function* () {
						const playlistAuthor = yield* artistService.findOrCreateArtist({
							name: data.owner.name,
							source: 'bilibili',
							remoteId: String(data.owner.mid),
							avatarUrl: data.owner.face,
						})

						const playlist = yield* playlistService.findOrCreateRemotePlaylist({
							title: data.title,
							description: data.desc,
							coverUrl: data.pic,
							type: 'multi_page',
							remoteSyncId: bv2av(bvid),
							authorId: playlistAuthor.id,
						})
						logger.debug('step 2: 创建 playlist 和其对应的 artist 信息完成', {
							id: playlist.id,
						})

						const trackCreateResult =
							yield* trackService.findOrCreateManyTracks(
								data.pages.map((page) => ({
									title: page.part,
									source: 'bilibili',
									bilibiliMetadata: {
										bvid: bvid,
										isMultiPage: true,
										cid: page.cid,
										videoIsValid: true,
										mainTrackTitle: data.title,
									},
									coverUrl: data.pic,
									duration: page.duration,
									artistId: playlistAuthor.id,
								})),
								'bilibili',
							)
						const trackIds = Array.from(trackCreateResult.values())
						logger.debug('step 3: 创建 tracks 完成', {
							total: trackIds.length,
						})

						yield* playlistService.replacePlaylistAllTracks(
							playlist.id,
							trackIds,
						)
						logger.debug('step 4: 替换 playlist 中所有 tracks 完成')
						logger.info('同步合集完成', {
							remoteId: bv2av(bvid),
							playlistId: playlist.id,
						})

						return playlist.id
					}).pipe(
						Effect.mapError(
							(e) =>
								new SyncMultiPageFailedError({
									message: '同步多集视频失败',
									cause: e,
								}),
						),
					)

					return yield* runInTransactionPreservingError(transactionEffect)
				} finally {
					syncingIds.delete(syncKey)
				}
			})

		const syncFavorite = (favoriteId: number) =>
			Effect.gen(function* () {
				const syncKey = `favorite::${favoriteId}`
				if (syncingIds.has(syncKey)) {
					return yield* new SyncTaskAlreadyRunningError()
				}
				try {
					syncingIds.add(syncKey)
					logger = log.extend('[Facade/SyncFavorite: ' + favoriteId + ']')
					logger.info('开始同步收藏夹', { favoriteId })
					logger.debug('syncFavorite', { favoriteId })

					const [
						bilibiliFavoriteListAllBvidsRaw,
						bilibiliFavoriteListMetadata,
					] = yield* Effect.all([
						bilibiliApi.getFavoriteListAllContents(favoriteId),
						bilibiliApi.getFavoriteListContents(favoriteId, 1),
					])

					const bilibiliFavoriteListAllBvids =
						bilibiliFavoriteListAllBvidsRaw.filter((item) => item.type === 2)
					logger.debug(
						'step 1: 调用 bilibiliapi getFavoriteListAllContents 完成',
						{
							total: bilibiliFavoriteListAllBvids.length,
						},
					)

					const localPlaylist =
						yield* playlistService.findPlaylistByTypeAndRemoteId(
							'favorite',
							favoriteId,
						)
					logger.debug('step 2: 查询本地收藏夹元数据完成', {
						localPlaylistId: localPlaylist?.id ?? '不存在',
					})

					let bvidsToAddSet: Set<string>
					let bvidsToRemoveSet: Set<string>
					const afterRemovedHiddenBvidsAllBvids = new Set<string>(
						bilibiliFavoriteListAllBvids.map((item) => item.bvid),
					)

					if (!localPlaylist || localPlaylist.itemCount === 0) {
						bvidsToAddSet = new Set(
							bilibiliFavoriteListAllBvids.map((item) => item.bvid),
						)
						bvidsToRemoveSet = new Set()
					} else {
						const existTracks = yield* playlistService.getPlaylistTracks(
							localPlaylist.id,
						)
						if (
							existTracks.find(
								(item) => item.source !== 'bilibili' || !item.bilibiliMetadata,
							)
						) {
							return yield* new SyncFavoriteFailedError({
								message:
									'同步收藏夹失败，收藏夹中存在非 Bilibili 的 Track，你的数据库似乎已经坏掉惹。',
							})
						}
						const biliTracks = existTracks as BilibiliTrack[]
						const diff = diffSets(
							new Set(bilibiliFavoriteListAllBvids.map((item) => item.bvid)),
							new Set(biliTracks.map((item) => item.bilibiliMetadata.bvid)),
						)
						bvidsToAddSet = diff.removed
						bvidsToRemoveSet = diff.added
					}

					logger.debug('step 3: 对远程和本地的 tracks 进行 diff 完成', {
						added: bvidsToAddSet.size,
						removed: bvidsToRemoveSet.size,
					})
					logger.info('收藏夹变更统计', {
						added: bvidsToAddSet.size,
						removed: bvidsToRemoveSet.size,
					})

					if (bvidsToAddSet.size === 0 && bvidsToRemoveSet.size === 0) {
						logger.info('收藏夹为空或与上次相比无变化，无需同步')
						return localPlaylist?.id
					}

					const addedTracksMetadata = new Set<BilibiliFavoriteListContent>()
					let nowPageNumber = 0
					let hasMore = true

					while (hasMore) {
						if (bvidsToAddSet.size === 0) {
							break
						}
						nowPageNumber += 1
						logger.debug('开始获取第 ' + nowPageNumber + ' 页收藏夹内容')
						const page = yield* bilibiliApi.getFavoriteListContents(
							favoriteId,
							nowPageNumber,
						)

						if (!page.medias) {
							return yield* new SyncFavoriteFailedError({
								message: '同步收藏夹失败，该收藏夹中没有任何 track',
							})
						}
						logger.debug(page.medias.length)
						hasMore = page.has_more
						for (const item of page.medias) {
							if (bvidsToAddSet.has(item.bvid)) {
								addedTracksMetadata.add(item)
								bvidsToAddSet.delete(item.bvid)
							}
						}
					}

					if (bvidsToAddSet.size > 0) {
						const tip = `Bilibili 隐藏了被 up 设置为仅自己可见的稿件，却没有更新索引，所以你会看到同步到的歌曲数量少于收藏夹实际显示的数量，具体隐藏稿件：${[...bvidsToAddSet].join(',')}`
						logger.warning(tip)
						toast.info(tip)
						for (const bvid of bvidsToAddSet) {
							afterRemovedHiddenBvidsAllBvids.delete(bvid)
						}
					}
					logger.debug('step 4: 获取要添加的 tracks 元数据完成', {
						added: addedTracksMetadata.size,
						requestApiTimes: nowPageNumber,
					})

					const transactionEffect = Effect.gen(function* () {
						const playlistAuthor = yield* artistService.findOrCreateArtist({
							name: bilibiliFavoriteListMetadata.info.upper.name,
							source: 'bilibili',
							remoteId: String(bilibiliFavoriteListMetadata.info.upper.mid),
							avatarUrl: bilibiliFavoriteListMetadata.info.upper.face,
						})

						const localPlaylist =
							yield* playlistService.findOrCreateRemotePlaylist({
								title: bilibiliFavoriteListMetadata.info.title,
								description: bilibiliFavoriteListMetadata.info.intro,
								coverUrl: bilibiliFavoriteListMetadata.info.cover,
								type: 'favorite',
								remoteSyncId: favoriteId,
								authorId: playlistAuthor.id,
							})

						logger.debug('step 5: 创建 playlist 和其对应的 author 信息完成', {
							localPlaylistId: localPlaylist.id,
							artistId: playlistAuthor.id,
						})

						const uniqueArtistPayloadsMap = new Map<
							string,
							CreateArtistPayload
						>()
						for (const trackMeta of addedTracksMetadata) {
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

						const artistsMap =
							yield* artistService.findOrCreateManyRemoteArtists(
								Array.from(uniqueArtistPayloadsMap.values()),
							)
						logger.debug('step 6: 创建 artist 完成', {
							total: artistsMap.size,
						})

						const addedTrackPayloads = Array.from(addedTracksMetadata).map(
							(v) => ({
								title: v.title,
								source: 'bilibili' as const,
								bilibiliMetadata: {
									bvid: v.bvid,
									isMultiPage: false,
									cid: undefined,
									videoIsValid: v.attr === 0,
								},
								coverUrl: v.cover,
								duration: v.duration,
								artistId: artistsMap.get(String(v.upper.mid))?.id,
							}),
						)

						const trackPayloadsWithKeys = yield* Effect.forEach(
							addedTrackPayloads,
							(p) =>
								generateUniqueTrackKey(p).pipe(
									Effect.map((uniqueKey) => ({
										payload: p,
										uniqueKey,
									})),
								),
						)

						const createdTracksMap = yield* trackService.findOrCreateManyTracks(
							trackPayloadsWithKeys.map((p) => p.payload),
							'bilibili',
						)
						logger.debug(
							'step 7: 创建或查找 tracks 并获取 uniqueKey->id 映射完成',
							{
								total: createdTracksMap.size,
							},
						)

						const orderedUniqueKeys = yield* Effect.forEach(
							Array.from(afterRemovedHiddenBvidsAllBvids),
							(bvid) =>
								generateUniqueTrackKey({
									source: 'bilibili',
									bilibiliMetadata: {
										bvid: bvid,
										isMultiPage: false,
										videoIsValid: true,
									},
								}),
						)
						logger.debug(
							'step 8: 为远程所有 tracks 生成了其对应的 uniqueKey 顺序列表',
							{
								total: orderedUniqueKeys.length,
							},
						)

						const uniqueKeyToIdMap =
							yield* trackService.findTrackIdsByUniqueKeys(orderedUniqueKeys)
						logger.debug(
							'step 9: 一次性获取所有 uniqueKey 到本地 ID 的映射完成',
							{
								total: uniqueKeyToIdMap.size,
							},
						)

						const finalOrderedTrackIds: number[] = []
						for (const key of orderedUniqueKeys) {
							const id = uniqueKeyToIdMap.get(key)
							if (id === undefined) {
								return yield* new SyncFavoriteFailedError({
									message:
										'已完成 tracks 创建后，却依然没有找到 uniqueKey 对应的 ID',
								})
							}
							finalOrderedTrackIds.push(id)
						}

						logger.debug(
							'step 10: 按 Bilibili 收藏夹顺序重排所有 tracks 完成',
							{
								total: finalOrderedTrackIds.length,
							},
						)

						yield* playlistService.replacePlaylistAllTracks(
							localPlaylist.id,
							finalOrderedTrackIds,
						)
						logger.debug('step 11: 替换 playlist 中所有 tracks 完成')
						logger.info('同步收藏夹完成', {
							remoteId: favoriteId,
							playlistId: localPlaylist.id,
						})

						return localPlaylist.id
					}).pipe(
						Effect.mapError(
							(e) =>
								new SyncFavoriteFailedError({
									message: '同步收藏夹失败',
									cause: e,
								}),
						),
					)

					return yield* runInTransactionPreservingError(transactionEffect)
				} finally {
					syncingIds.delete(syncKey)
				}
			})

		return {
			addTrackFromBilibiliApi,
			addTrackToLocal,
			syncCollection,
			syncMultiPageVideo,
			syncFavorite,
			sync: (remoteSyncId, type) =>
				Effect.gen(function* () {
					switch (type) {
						case 'favorite': {
							return yield* syncFavorite(remoteSyncId)
						}
						case 'collection': {
							return yield* syncCollection(remoteSyncId)
						}
						case 'multi_page': {
							return yield* syncMultiPageVideo(av2bv(remoteSyncId))
						}
						case 'local': {
							return undefined
						}
					}
				}),
		}
	}),
)

export const syncFacade = Effect.serviceFunctions(SyncFacade)
