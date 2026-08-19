import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'

import type { bilibiliApi as BilibiliApiService } from '@/lib/api/bilibili/api'
import { bilibiliApi as bilibiliApiInstance } from '@/lib/api/bilibili/api'
import { av2bv, bv2av } from '@/lib/api/bilibili/utils'
import defaultDb from '@/lib/db/db'
import type * as schema from '@/lib/db/schema'
import type { DatabaseError, ServiceError } from '@/lib/errors'
import type { FacadeError } from '@/lib/errors/facade'
import {
	createFacadeError,
	createSyncTaskAlreadyRunningError,
} from '@/lib/errors/facade'
import { createValidationError } from '@/lib/errors/service'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { analyticsService } from '@/lib/services/analyticsService'
import type { ArtistService } from '@/lib/services/artistService'
import { artistService as artistServiceInstance } from '@/lib/services/artistService'
import generateUniqueTrackKey from '@/lib/services/genKey'
import type { PlaylistService } from '@/lib/services/playlistService'
import { playlistService as playlistServiceInstance } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import { trackService as trackServiceInstance } from '@/lib/services/trackService'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import type { BilibiliMultipageVideo } from '@/types/apis/bilibili'
import type { BilibiliTrack, Playlist, Track } from '@/types/core/media'
import type { CreateArtistPayload } from '@/types/services/artist'
import log from '@/utils/log'
import { diffSets } from '@/utils/set'
import toast from '@/utils/toast'

export interface FavoriteSyncProgress {
	message: string
	current?: number
	total?: number
	stage:
		| 'initializing'
		| 'fetching_metadata'
		| 'calculating_diff'
		| 'fetching_details'
		| 'saving'
		| 'completed'
		| 'error'
}

/** 展开分 P 后的单条 track 数据 */
interface ExpandedTrackData {
	bvid: string
	title: string
	duration: number
	cid: number | null
	isMultiPage: boolean
	mainTrackTitle?: string | null
	videoIsValid: boolean
	coverUrl: string | null
	artistId?: number
	upperMid?: number
}

const PAGE_LIST_CONCURRENCY = 6

let logger = log.extend('Facade')

export class SyncBilibiliPlaylistFacade {
	private syncingIds = new Set<string>()
	constructor(
		private readonly trackService: TrackService,
		private readonly bilibiliApi: typeof BilibiliApiService,
		private readonly playlistService: PlaylistService,
		private readonly artistService: ArtistService,
		private readonly db: ExpoSQLiteDatabase<typeof schema>,
	) {}

	/**
	 * 并发获取一批 bvid 的分 P 列表。
	 * ResponseFailed（视频失效等业务性失败）的 bvid 折叠为单条跳过，记录在 skippedBvids；
	 * 网络类失败（RequestFailed/RequestAborted）则整体失败
	 */
	private async fetchPageLists(bvids: string[]): Promise<
		Result<
			{
				pageLists: Map<string, BilibiliMultipageVideo[]>
				skippedBvids: string[]
			},
			BilibiliApiError
		>
	> {
		const results = new Map<string, BilibiliMultipageVideo[]>()
		const skippedBvids: string[] = []
		let index = 0
		let firstError: BilibiliApiError | null = null
		const worker = async () => {
			while (index < bvids.length && !firstError) {
				const bvid = bvids[index]
				index += 1
				// oxlint-disable-next-line no-await-in-loop
				const res = await this.bilibiliApi.getPageList({ bvid })
				if (res.isErr()) {
					if (res.error.type === 'ResponseFailed') {
						logger.warning('获取分 P 列表失败，折叠为单条', {
							bvid,
							message: res.error.message,
						})
						skippedBvids.push(bvid)
						continue
					}
					firstError = res.error
					logger.error('展开分 P：分 P 列表查询失败', {
						bvid,
						type: res.error.type,
						message: res.error.message,
					})
					return
				}
				results.set(bvid, res.value)
			}
		}
		await Promise.all(
			Array.from(
				{ length: Math.min(PAGE_LIST_CONCURRENCY, bvids.length) },
				() => worker(),
			),
		)
		if (firstError) {
			return err(firstError)
		}
		return ok({ pageLists: results, skippedBvids })
	}

	/**
	 * 将分 P 列表展开为 track 数据；单 P 视频折叠为单条（isMultiPage: false）
	 */
	private expandFromPages(
		bvid: string,
		pages: BilibiliMultipageVideo[],
		mainInfo: {
			title: string
			coverUrl: string | null
			duration: number
			videoIsValid: boolean
			artistId?: number
			upperMid?: number
		},
	): ExpandedTrackData[] {
		if (pages.length <= 1) {
			return [
				{
					bvid,
					title: mainInfo.title,
					duration: mainInfo.duration,
					cid: null,
					isMultiPage: false,
					videoIsValid: mainInfo.videoIsValid,
					coverUrl: mainInfo.coverUrl,
					artistId: mainInfo.artistId,
					upperMid: mainInfo.upperMid,
				},
			]
		}
		return pages.map((p) => ({
			bvid,
			title: p.part,
			duration: p.duration,
			cid: p.cid,
			isMultiPage: true,
			mainTrackTitle: mainInfo.title,
			videoIsValid: mainInfo.videoIsValid,
			coverUrl: mainInfo.coverUrl,
			artistId: mainInfo.artistId,
			upperMid: mainInfo.upperMid,
		}))
	}

	/**
	 * 从 Bilibili API 获取视频信息，并创建一个新的音轨。
	 * @param bvid
	 * @param cid 基于 cid 是否存在判断 isMultiPage 的值
	 * @returns
	 */
	public addTrackFromBilibiliApi(
		bvid: string,
		cid?: number,
	): ResultAsync<Track, BilibiliApiError | DatabaseError | ServiceError> {
		logger.info('开始添加 Track（Bilibili）', { bvid, cid })
		const apiData = this.bilibiliApi.getVideoDetails({ bvid })
		return apiData.andThen((data) => {
			const trackPayload = {
				title: data.title,
				source: 'bilibili' as const,
				bilibiliMetadata: {
					bvid,
					cid: cid,
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
			return this.trackService
				.findOrCreateTrack(trackPayload)
				.andTee((track) => {
					logger.info('添加 Track 成功', {
						trackId: track.id,
						title: track.title,
						source: track.source,
					})
				})
		})
	}

	/**
	 * 将单一 track 录入到本地数据库
	 * @param track Track 对象
	 */
	public addTrackToLocal(track: Track) {
		if (!track.artist) return errAsync(createValidationError('artist 不存在'))
		return this.artistService
			.findOrCreateArtist({
				name: track.artist.name,
				source: track.artist.source,
				remoteId: track.artist.remoteId,
				avatarUrl: track.artist.avatarUrl,
				signature: track.artist.signature,
			})
			.andThen((artist) => {
				return this.trackService.findOrCreateTrack({
					...track,
					artistId: artist.id,
				})
			})
	}

	/**
	 * 同步合集内容
	 * @param collectionId 合集 id
	 * @returns ResultAsync<number, FacadeError>
	 */
	public syncCollection(
		collectionId: number,
	): ResultAsync<number, BilibiliApiError | FacadeError> {
		if (this.syncingIds.has(`collection::${collectionId}`)) {
			logger.info('已有同步任务在进行，跳过', {
				type: 'collection',
				id: collectionId,
			})
			return errAsync(createSyncTaskAlreadyRunningError())
		}
		try {
			this.syncingIds.add(`collection::${collectionId}`)
			logger = log.extend('[Facade/SyncCollection: ' + collectionId + ']')
			logger.info('开始同步合集', { collectionId })
			logger.debug('syncCollection', { collectionId })
			return this.bilibiliApi
				.getCollectionAllContents({ collectionId })
				.andTee(() =>
					logger.debug(
						'step 1: 调用 bilibiliapi getCollectionAllContents 完成',
					),
				)
				.andThen((contents) => {
					logger.info('获取合集详情成功', {
						title: contents.info.title,
						total: contents.medias?.length ?? 0,
					})
					const medias = contents.medias ?? []
					if (medias.length === 0) {
						return errAsync(
							createFacadeError(
								'SyncCollectionFailed',
								'同步合集失败，该合集中没有任何 track',
							),
						)
					}
					return ResultAsync.fromPromise(
						this.db.transaction(async (tx) => {
							const playlistSvc = this.playlistService.withDB(tx)
							const trackSvc = this.trackService.withDB(tx)
							const artistSvc = this.artistService.withDB(tx)

							const playlistArtistId = await artistSvc.findOrCreateArtist({
								name: contents.info.upper.name,
								source: 'bilibili',
								remoteId: String(contents.info.upper.mid),
							})
							if (playlistArtistId.isErr()) throw playlistArtistId.error

							const playlistRes = await playlistSvc.findOrCreateRemotePlaylist({
								title: contents.info.title,
								description: contents.info.intro,
								coverUrl: contents.info.cover,
								type: 'collection',
								remoteSyncId: collectionId,
								authorId: playlistArtistId.value.id,
							})
							if (playlistRes.isErr()) throw playlistRes.error
							logger.debug('step 2: 创建 playlist 和其对应的 artist 信息完成', {
								id: playlistRes.value.id,
							})

							const uniqueArtists = new Map<number, { name: string }>()
							for (const media of medias) {
								if (!uniqueArtists.has(media.upper.mid)) {
									uniqueArtists.set(media.upper.mid, {
										name: media.upper.name,
									})
								}
							}

							const artistRes = await artistSvc.findOrCreateManyRemoteArtists(
								Array.from(uniqueArtists, ([remoteId, artistInfo]) => ({
									name: artistInfo.name,
									source: 'bilibili',
									remoteId: String(remoteId),
									avatarUrl: undefined,
								})),
							)
							if (artistRes.isErr()) throw artistRes.error
							const localArtistIdMap = artistRes.value
							logger.debug('step 3: 创建 artist 完成', {
								uniqueCount: uniqueArtists.size,
							})

							const tracksCreateResult = await trackSvc.findOrCreateManyTracks(
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
							if (tracksCreateResult.isErr()) throw tracksCreateResult.error
							const trackIds = Array.from(tracksCreateResult.value.values())
							logger.debug('step 4: 创建 tracks 完成', {
								total: trackIds.length,
							})

							// 我们不需要去更新 lastSyncedAt 字段，因为在 replacePlaylistAllTracks 中会更新
							const replaceResult = await playlistSvc.replacePlaylistAllTracks(
								playlistRes.value.id,
								trackIds,
							)
							if (replaceResult.isErr()) {
								throw replaceResult.error
							}
							logger.debug('step 5: 替换 playlist 中所有 tracks 完成')
							logger.info('同步合集完成', {
								remoteId: contents.info.id,
								playlistId: playlistRes.value.id,
							})
							void analyticsService.logPlaylistSync(
								'sync_bilibili',
								'collection',
								trackIds.length,
							)
							return playlistRes.value.id
						}),
						(e) =>
							createFacadeError('SyncCollectionFailed', '同步合集失败', {
								cause: e,
							}),
					)
				})
		} finally {
			this.syncingIds.delete(`collection::${collectionId}`)
		}
	}

	/**
	 * 同步多集视频
	 * @param bvid
	 */
	public syncMultiPageVideo(
		bvid: string,
	): ResultAsync<number, BilibiliApiError | FacadeError> {
		if (this.syncingIds.has(`multiPage::${bvid}`)) {
			logger.info('已有同步任务在进行，跳过', {
				type: 'multi_page',
				bvid,
			})
			return errAsync(createSyncTaskAlreadyRunningError())
		}
		try {
			this.syncingIds.add(`multiPage::${bvid}`)
			logger = log.extend('[Facade/SyncMultiPageVideo: ' + bvid + ']')
			logger.info('开始同步多集视频', { bvid })
			return this.bilibiliApi
				.getVideoDetails({ bvid })
				.andTee(() =>
					logger.debug('step 1: 调用 bilibiliapi getVideoDetails 完成'),
				)
				.andThen((data) => {
					logger.info('获取多集视频详情成功', {
						title: data.title,
						pages: data.pages.length,
					})
					return ResultAsync.fromPromise(
						this.db.transaction(async () => {
							const playlistSvc = this.playlistService.withDB(this.db)
							const trackSvc = this.trackService.withDB(this.db)
							const artistSvc = this.artistService.withDB(this.db)

							const playlistAuthor = await artistSvc.findOrCreateArtist({
								name: data.owner.name,
								source: 'bilibili',
								remoteId: String(data.owner.mid),
								avatarUrl: data.owner.face,
							})
							if (playlistAuthor.isErr()) throw playlistAuthor.error

							const playlistRes = await playlistSvc.findOrCreateRemotePlaylist({
								title: data.title,
								description: data.desc,
								coverUrl: data.pic,
								type: 'multi_page',
								remoteSyncId: bv2av(bvid),
								authorId: playlistAuthor.value.id,
							})
							if (playlistRes.isErr()) throw playlistRes.error
							logger.debug('step 2: 创建 playlist 和其对应的 artist 信息完成', {
								id: playlistRes.value.id,
							})

							const trackCreateResult = await trackSvc.findOrCreateManyTracks(
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
									artistId: playlistAuthor.value.id,
								})),
								'bilibili',
							)
							if (trackCreateResult.isErr()) throw trackCreateResult.error
							const trackIds = Array.from(trackCreateResult.value.values())
							logger.debug('step 3: 创建 tracks 完成', {
								total: trackIds.length,
							})

							// 我们不需要去更新 lastSyncedAt 字段，因为在 replacePlaylistAllTracks 中会更新
							const replaceResult = await playlistSvc.replacePlaylistAllTracks(
								playlistRes.value.id,
								trackIds,
							)
							if (replaceResult.isErr()) {
								throw replaceResult.error
							}
							logger.debug('step 4: 替换 playlist 中所有 tracks 完成')
							logger.info('同步合集完成', {
								remoteId: bv2av(bvid),
								playlistId: playlistRes.value.id,
							})

							void analyticsService.logPlaylistSync(
								'sync_bilibili',
								'multi_page',
								trackIds.length,
							)

							return playlistRes.value.id
						}),
						(e) =>
							createFacadeError('SyncMultiPageFailed', '同步多集视频失败', {
								cause: e,
							}),
					)
				})
		} finally {
			this.syncingIds.delete(`multiPage::${bvid}`)
		}
	}

	/**
	 * 同步收藏夹内容，会对要同步的内容做基础的 diff 处理
	 * @param favoriteId 收藏夹 ID
	 * @param expandMultiPage 是否展开分 P 视频
	 * @returns Result 成功时为 playlist ID，undefined 表示远端收藏夹为空，并且本地之前也没有创建过（这种情况前端不应该显示同步按钮）
	 */
	public async syncFavorite(
		favoriteId: number,
		onProgress?: (progress: FavoriteSyncProgress) => void,
		expandMultiPage = false,
	): Promise<Result<number | undefined, FacadeError | BilibiliApiError>> {
		// getFavoriteListAllContents 获取到的 bvid 中会包含被 up 隐藏的视频，但这部分视频在 getFavoriteListContents 中是找不到的，也就无法添加到本地数据库。这导致对于包含这种视频的收藏夹，每次同步都会重新「同步」这些视频，但咱们没办法......
		if (this.syncingIds.has(`favorite::${favoriteId}`)) {
			return err(createSyncTaskAlreadyRunningError())
		}
		try {
			this.syncingIds.add(`favorite::${favoriteId}`)
			onProgress?.({
				message: '初始化同步任务...',
				stage: 'initializing',
			})
			logger = log.extend('[Facade/SyncFavorite: ' + favoriteId + ']')
			logger.info('开始同步收藏夹', { favoriteId })
			logger.debug('syncFavorite', { favoriteId })

			// 从 bilibili 获取基本元数据和收藏夹所有 bvid
			onProgress?.({
				message: '正在获取收藏夹元数据...',
				stage: 'fetching_metadata',
			})
			const bilibiliResult = await ResultAsync.combine([
				this.bilibiliApi.getFavoriteListAllContents({ favoriteId }),
				this.bilibiliApi.getFavoriteListContents({ favoriteId, pn: 1 }),
			])
			if (bilibiliResult.isErr()) {
				return err(bilibiliResult.error)
			}
			const bilibiliFavoriteListMetadata = bilibiliResult.value[1]
			if (!bilibiliFavoriteListMetadata.info) {
				return err(
					createFacadeError(
						'SyncFavoriteFailed',
						'同步收藏夹失败，数据为空，收藏夹可能不存在',
					),
				)
			}
			const bilibiliFavoriteListAllBvids = bilibiliResult.value[0].filter(
				(item) => item.type === 2, // 过滤非视频稿件 (type 2 is video)
			)
			logger.debug('step 1: 调用 bilibiliapi getFavoriteListAllContents 完成', {
				total: bilibiliFavoriteListAllBvids.length,
			})

			// 查询本地收藏夹元数据
			const localPlaylist =
				await this.playlistService.findPlaylistByTypeAndRemoteId(
					'favorite',
					favoriteId,
				)
			if (localPlaylist.isErr()) {
				return err(localPlaylist.error)
			}
			logger.debug('step 2: 查询本地收藏夹元数据完成', {
				localPlaylistId: localPlaylist.value?.id ?? '不存在',
			})

			// 开始计算 diff
			onProgress?.({
				message: '正在比对本地数据...',
				stage: 'calculating_diff',
			})
			let bvidsToAddSet: Set<string>
			let bvidsToRemoveSet: Set<string>
			let biliTracks: BilibiliTrack[] = []
			const afterRemovedHiddenBvidsAllBvids = new Set<string>(
				bilibiliFavoriteListAllBvids.map((item) => item.bvid),
			) // 删除被隐藏的视频后的所有 bvid（在元数据请求完成后处理删除逻辑）

			if (!localPlaylist.value || localPlaylist.value.itemCount === 0) {
				// 本地收藏夹为空或没创建过，则全部添加
				bvidsToAddSet = new Set(
					bilibiliFavoriteListAllBvids.map((item) => item.bvid),
				)
				bvidsToRemoveSet = new Set()
			} else {
				const existTracks = await this.playlistService.getPlaylistTracks(
					localPlaylist.value.id,
				)
				if (existTracks.isErr()) {
					return err(existTracks.error)
				}
				if (existTracks.value.find((item) => item.source !== 'bilibili')) {
					return err(
						createFacadeError(
							'SyncFavoriteFailed',
							'同步收藏夹失败，收藏夹中存在非 Bilibili 的 Track，你的数据库似乎已经坏掉惹。',
						),
					)
				}
				biliTracks = existTracks.value as BilibiliTrack[]
				const diff = diffSets(
					new Set(bilibiliFavoriteListAllBvids.map((item) => item.bvid)),
					new Set(biliTracks.map((item) => item.bilibiliMetadata.bvid)),
				)
				// 注意，这里是相反的
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
				const localIsExpanded = biliTracks.some(
					(t) => t.bilibiliMetadata.isMultiPage,
				)
				if (localIsExpanded === expandMultiPage) {
					logger.info('收藏夹为空或与上次相比无变化，无需同步')
					return ok(localPlaylist.value?.id)
				}
				// 收藏夹内容无变化，但所选同步模式与本地状态不一致（切换了展开/折叠），按所选模式重建
				// uniqueKey 依赖 isMultiPage，重建必须按所选模式重新生成所有 track，因此把全部 bvid 视为新增
				logger.info(
					'收藏夹内容无变化，但同步模式与本地状态不一致，按所选模式重建',
				)
				bvidsToAddSet = new Set(afterRemovedHiddenBvidsAllBvids)
			}

			// 开始获取收藏夹新增部分 bvid 的详细元数据
			// 从第一页（最新）开始获取，直到所有新增的 bvid 都获取完成
			onProgress?.({
				message: `准备同步 ${bvidsToAddSet.size} 个新视频...`,
				current: 0,
				total: bvidsToAddSet.size,
				stage: 'fetching_details',
			})

			const addedTracksMetadata = new Set<BilibiliFavoriteListContent>()
			let nowPageNumber = 0
			let hasMore = true
			const totalToAdd = bvidsToAddSet.size
			let fetchedCount = 0

			while (hasMore) {
				if (bvidsToAddSet.size === 0) {
					break
				}
				nowPageNumber += 1
				onProgress?.({
					message: `正在获取第 ${nowPageNumber} 页详情...`,
					current: fetchedCount,
					total: totalToAdd,
					stage: 'fetching_details',
				})
				logger.debug('开始获取第 ' + nowPageNumber + ' 页收藏夹内容')
				// oxlint-disable-next-line no-await-in-loop
				const pageResult = await this.bilibiliApi.getFavoriteListContents({
					favoriteId,
					pn: nowPageNumber,
				})
				if (pageResult.isErr()) {
					return errAsync(pageResult.error)
				}
				const page = pageResult.value
				if (!page.medias) {
					return errAsync(
						createFacadeError(
							'SyncFavoriteFailed',
							'同步收藏夹失败，该收藏夹中没有任何 track',
						),
					)
				}
				logger.debug(page.medias.length)
				hasMore = page.has_more
				for (const item of page.medias) {
					if (bvidsToAddSet.has(item.bvid)) {
						addedTracksMetadata.add(item)
						bvidsToAddSet.delete(item.bvid)
						fetchedCount++
					}
				}
				onProgress?.({
					message: `已获取 ${fetchedCount}/${totalToAdd} 个视频详情...`,
					current: fetchedCount,
					total: totalToAdd,
					stage: 'fetching_details',
				})
			}
			if (bvidsToAddSet.size > 0) {
				const tip = `Bilibili 隐藏了被 up 设置为仅自己可见的稿件，却没有更新索引，所以你会看到同步到的歌曲数量少于收藏夹实际显示的数量，具体隐藏稿件：${[...bvidsToAddSet].join(',')}`
				logger.warning(tip)
				toast.info(tip)
				// 在复制的 allBvids Set 中删除隐藏的视频
				for (const bvid of bvidsToAddSet) {
					afterRemovedHiddenBvidsAllBvids.delete(bvid)
				}
			}
			logger.debug('step 4: 获取要添加的 tracks 元数据完成', {
				added: addedTracksMetadata.size,
				requestApiTimes: nowPageNumber,
			})

			// 展开分 P：为收藏夹内所有 bvid 构建展开后的 track 数据
			// 新增 bvid 与本地为折叠态的 bvid 需要查分 P 列表；本地已展开的 bvid 直接复用，不发请求
			let expandedTracksMap: Map<string, ExpandedTrackData[]> | null = null
			if (expandMultiPage) {
				onProgress?.({
					message: '正在获取分 P 信息...',
					stage: 'fetching_details',
				})
				const localGrouped = new Map<string, BilibiliTrack[]>()
				for (const track of biliTracks) {
					const list = localGrouped.get(track.bilibiliMetadata.bvid) ?? []
					list.push(track)
					localGrouped.set(track.bilibiliMetadata.bvid, list)
				}
				const allBvids = Array.from(afterRemovedHiddenBvidsAllBvids)

				const mainInfoMap = new Map<
					string,
					{
						title: string
						coverUrl: string | null
						duration: number
						videoIsValid: boolean
						pageCount?: number
						artistId?: number
						upperMid?: number
					}
				>()
				for (const item of addedTracksMetadata) {
					mainInfoMap.set(item.bvid, {
						title: item.title,
						coverUrl: item.cover,
						duration: item.duration,
						videoIsValid: item.attr === 0,
						pageCount: item.page,
						upperMid: item.upper.mid,
					})
				}
				for (const [bvid, local] of localGrouped) {
					if (mainInfoMap.has(bvid)) continue
					const first = local[0]
					mainInfoMap.set(bvid, {
						title: first.title,
						coverUrl: first.coverUrl,
						duration: first.duration,
						videoIsValid: first.bilibiliMetadata.videoIsValid,
						artistId: first.artist?.id,
					})
				}

				const toQueryBvids = allBvids.filter((bvid) => {
					const local = localGrouped.get(bvid)
					if (local?.some((t) => t.bilibiliMetadata.isMultiPage)) {
						return false
					}
					const info = mainInfoMap.get(bvid)
					// 失效视频无法获取分 P 信息，折叠为单条兜底（与不展开模式一致）
					if (info && !info.videoIsValid) return false
					// 收藏夹接口直接带分 P 数量，单 P 视频无需查询
					if (info && info.pageCount !== undefined && info.pageCount <= 1) {
						return false
					}
					return true
				})
				logger.debug('展开分 P：统计', {
					total: allBvids.length,
					reused: allBvids.length - toQueryBvids.length,
					toQuery: toQueryBvids.length,
					singlePageSkipped: Array.from(mainInfoMap.values()).filter(
						(v) => v.pageCount !== undefined && v.pageCount <= 1,
					).length,
					locallyCollapsed: Array.from(mainInfoMap.values()).filter(
						(v) => !v.videoIsValid,
					).length,
				})
				const pageListsResult = await this.fetchPageLists(toQueryBvids)
				if (pageListsResult.isErr()) {
					return err(pageListsResult.error)
				}
				const { pageLists, skippedBvids } = pageListsResult.value
				if (skippedBvids.length > 0) {
					logger.warning('展开分 P：以下视频查询失败，已折叠为单条', {
						bvids: skippedBvids,
					})
				}

				expandedTracksMap = new Map()
				for (const bvid of allBvids) {
					const local = localGrouped.get(bvid)
					if (local?.some((t) => t.bilibiliMetadata.isMultiPage)) {
						expandedTracksMap.set(
							bvid,
							local.map((t) => ({
								bvid,
								title: t.title,
								duration: t.duration,
								cid: t.bilibiliMetadata.cid,
								isMultiPage: true,
								mainTrackTitle: t.bilibiliMetadata.mainTrackTitle,
								videoIsValid: t.bilibiliMetadata.videoIsValid,
								coverUrl: t.coverUrl,
								artistId: t.artist?.id,
							})),
						)
						continue
					}
					const info = mainInfoMap.get(bvid)
					if (!info) {
						return err(
							createFacadeError(
								'SyncFavoriteFailed',
								'展开分 P 失败：缺少视频元数据',
							),
						)
					}
					expandedTracksMap.set(
						bvid,
						this.expandFromPages(bvid, pageLists.get(bvid) ?? [], info),
					)
				}
				logger.debug('step 5: 展开分 P 视频完成', {
					total: allBvids.length,
				})
			}

			onProgress?.({
				message: '正在保存数据到数据库...',
				stage: 'saving',
			})
			const txResult = await ResultAsync.fromPromise(
				this.db.transaction(async (tx) => {
					const playlistSvc = this.playlistService.withDB(tx)
					const trackSvc = this.trackService.withDB(tx)
					const artistSvc = this.artistService.withDB(tx)

					const playlistAuthor = await artistSvc.findOrCreateArtist({
						name: bilibiliFavoriteListMetadata.info!.upper.name,
						source: 'bilibili',
						remoteId: String(bilibiliFavoriteListMetadata.info!.upper.mid),
						avatarUrl: bilibiliFavoriteListMetadata.info!.upper.face,
					})
					if (playlistAuthor.isErr()) {
						throw playlistAuthor.error
					}

					const playlistResult = await playlistSvc.findOrCreateRemotePlaylist({
						title: bilibiliFavoriteListMetadata.info!.title,
						description: bilibiliFavoriteListMetadata.info!.intro,
						coverUrl: bilibiliFavoriteListMetadata.info!.cover,
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

					const uniqueArtistPayloads = Array.from(
						uniqueArtistPayloadsMap.values(),
					)
					const artistsMap =
						await artistSvc.findOrCreateManyRemoteArtists(uniqueArtistPayloads)
					if (artistsMap.isErr()) {
						throw artistsMap.error
					}
					logger.debug('step 6: 创建 artist 完成', {
						total: artistsMap.value.size,
					})

					// All expanded entries must be included, including BVIDs that were
					// previously stored in collapsed form. Otherwise their new `bvid::cid`
					// keys are used for ordering without ever being created.
					const trackPayloads = expandedTracksMap
						? Array.from(expandedTracksMap.entries()).flatMap(([, tracks]) =>
								tracks.map((t) => ({
									title: t.title,
									source: 'bilibili' as const,
									bilibiliMetadata: {
										bvid: t.bvid,
										isMultiPage: t.isMultiPage,
										cid: t.cid ?? null,
										mainTrackTitle: t.mainTrackTitle,
										videoIsValid: t.videoIsValid,
									},
									coverUrl: t.coverUrl,
									duration: t.duration,
									artistId:
										t.artistId ?? artistsMap.value.get(String(t.upperMid))?.id,
								})),
							)
						: Array.from(addedTracksMetadata).map((v) => ({
								title: v.title,
								source: 'bilibili' as const,
								bilibiliMetadata: {
									bvid: v.bvid,
									isMultiPage: false,
									cid: null,
									videoIsValid: v.attr === 0,
								},
								coverUrl: v.cover,
								duration: v.duration,
								artistId: artistsMap.value.get(String(v.upper.mid))?.id,
							}))

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
					logger.debug(
						'step 7: 创建或查找 tracks 并获取 uniqueKey->id 映射完成',
						{
							total: createdTracksMapResult.value.size,
						},
					)

					// 在这里我们使用清洗过后的 afterRemovedHiddenBvidsAllBvids，而非原始的 bilibiliFavoriteListAllBvids
					// 因为在原始数据中，可能存在隐藏的视频，但是在清洗后，这些视频已经被删除了
					const orderedUniqueKeysResult = expandedTracksMap
						? Result.combine(
								Array.from(afterRemovedHiddenBvidsAllBvids).flatMap((bvid) =>
									(expandedTracksMap.get(bvid) ?? []).map((t) =>
										generateUniqueTrackKey({
											source: 'bilibili',
											bilibiliMetadata: {
												bvid: t.bvid,
												isMultiPage: t.isMultiPage,
												cid: t.cid ?? undefined,
												videoIsValid: true,
											},
										}),
									),
								),
							)
						: Result.combine(
								Array.from(afterRemovedHiddenBvidsAllBvids).map((bvid) =>
									generateUniqueTrackKey({
										source: 'bilibili',
										bilibiliMetadata: {
											bvid: bvid,
											isMultiPage: false,
											videoIsValid: true,
										},
									}),
								),
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
					logger.debug(
						'step 9: 一次性获取所有 uniqueKey 到本地 ID 的映射完成',
						{
							total: uniqueKeyToIdMap.size,
						},
					)

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

					void analyticsService.logPlaylistSync(
						'sync_bilibili',
						'favorite',
						finalOrderedTrackIds.length,
					)

					return playlistResult.value.id
				}),
				(e) =>
					createFacadeError('SyncFavoriteFailed', '同步收藏夹失败', {
						cause: e,
					}),
			)
			if (txResult.isErr()) {
				return err(txResult.error)
			}
			return ok(txResult.value)
		} finally {
			this.syncingIds.delete(`favorite::${favoriteId}`)
		}
	}

	/**
	 * 根据传入的同步 ID 和类型同步播放列表
	 * @param remoteSyncId 远程同步 ID
	 * @param type 播放列表类型
	 * @param expandMultiPage 是否展开分 P 视频
	 * @returns
	 */
	public sync(
		remoteSyncId: number,
		type: Playlist['type'],
		onProgress?: (progress: FavoriteSyncProgress) => void,
		expandMultiPage = false,
	) {
		switch (type) {
			case 'favorite': {
				return this.syncFavorite(remoteSyncId, onProgress, expandMultiPage)
			}
			case 'collection': {
				return this.syncCollection(remoteSyncId)
			}
			case 'multi_page': {
				return this.syncMultiPageVideo(av2bv(remoteSyncId))
			}
			case 'local': {
				return okAsync(undefined)
			}
			case 'dynamic': {
				return okAsync(undefined)
			}
		}
	}

	public get dbInstance() {
		return this.db
	}
}

export const syncFacade = new SyncBilibiliPlaylistFacade(
	trackServiceInstance,
	bilibiliApiInstance,
	playlistServiceInstance,
	artistServiceInstance,
	defaultDb,
)
