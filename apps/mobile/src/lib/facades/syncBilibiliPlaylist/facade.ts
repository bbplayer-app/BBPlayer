import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { err, errAsync, okAsync, Result, ResultAsync } from 'neverthrow'

import type { bilibiliApi as BilibiliApiService } from '@/lib/api/bilibili/api'
import { av2bv, bv2av } from '@/lib/api/bilibili/utils'
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
import type { PlaylistService } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import type { BilibiliCollectionAllContents } from '@/types/apis/bilibili'
import type { Playlist, Track } from '@/types/core/media'
import log from '@/utils/log'
import toast from '@/utils/toast'

import { runFavoriteSync } from './favorite'
import type { PlaylistSyncProgress } from './types'

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

	/** 合集单次读取，系列逐页读取，两者只共享入库事务。 */
	public syncCollection(
		collectionId: number,
	): ResultAsync<number, BilibiliApiError | FacadeError> {
		const syncKey = `collection::${collectionId}`
		if (this.syncingIds.has(syncKey)) {
			return errAsync(createSyncTaskAlreadyRunningError())
		}
		this.syncingIds.add(syncKey)
		try {
			return this.bilibiliApi
				.getCollectionAllContents({ collectionId })
				.andThen((contents) =>
					this.saveRemoteMediaList(contents, collectionId, 'collection'),
				)
				.andTee(() => {
					this.syncingIds.delete(syncKey)
				})
				.orTee(() => {
					this.syncingIds.delete(syncKey)
				})
		} catch (error) {
			this.syncingIds.delete(syncKey)
			throw error
		}
	}

	public syncSeries(
		seriesId: number,
		onProgress?: (progress: PlaylistSyncProgress) => void,
	): ResultAsync<number, BilibiliApiError | FacadeError> {
		const syncKey = `series::${seriesId}`
		if (this.syncingIds.has(syncKey)) {
			return errAsync(createSyncTaskAlreadyRunningError())
		}
		this.syncingIds.add(syncKey)
		onProgress?.({ stage: 'fetching_metadata', message: '正在获取系列信息...' })
		try {
			return this.bilibiliApi
				.getSeriesAllContents({
					seriesId,
					onPage: (loaded, total) =>
						onProgress?.({
							stage: 'fetching_details',
							message: `已获取 ${loaded}/${total} 首`,
							current: loaded,
							total,
						}),
				})
				.andThen((contents) => {
					onProgress?.({ stage: 'saving', message: '正在保存系列到本地...' })
					return this.saveRemoteMediaList(contents, seriesId, 'series')
				})
				.andTee(() => {
					this.syncingIds.delete(syncKey)
				})
				.orTee(() => {
					this.syncingIds.delete(syncKey)
				})
		} catch (error) {
			this.syncingIds.delete(syncKey)
			throw error
		}
	}

	private saveRemoteMediaList(
		contents: BilibiliCollectionAllContents,
		remoteId: number,
		type: 'collection' | 'series',
	): ResultAsync<number, FacadeError> {
		logger.info('获取播放列表详情成功', {
			title: contents.info.title,
			total: contents.medias?.length ?? 0,
		})
		const medias = contents.medias ?? []
		if (medias.length === 0) {
			return errAsync(
				createFacadeError(
					type === 'series' ? 'SyncSeriesFailed' : 'SyncCollectionFailed',
					`同步${type === 'series' ? '系列' : '合集'}失败，该列表中没有任何 track`,
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
					type,
					remoteSyncId: remoteId,
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
					Array.from(uniqueArtists, ([artistRemoteId, artistInfo]) => ({
						name: artistInfo.name,
						source: 'bilibili',
						remoteId: String(artistRemoteId),
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
				logger.info('同步播放列表完成', {
					remoteId: contents.info.id,
					playlistId: playlistRes.value.id,
				})
				void analyticsService.logPlaylistSync(
					'sync_bilibili',
					type,
					trackIds.length,
				)
				return playlistRes.value.id
			}),
			(e) =>
				createFacadeError(
					type === 'series' ? 'SyncSeriesFailed' : 'SyncCollectionFailed',
					`同步${type === 'series' ? '系列' : '合集'}失败`,
					{
						cause: e,
					},
				),
		)
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
	 * 同步收藏夹内容，会对要同步的内容做基础的 diff 处理。
	 * 具体流程拆分为阶段函数，见 ./favorite。
	 * @param favoriteId 收藏夹 ID
	 * @param expandMultiPage 是否展开分 P 视频
	 * @returns Result 成功时为 playlist ID，undefined 表示远端收藏夹为空，并且本地之前也没有创建过（这种情况前端不应该显示同步按钮）
	 */
	public async syncFavorite(
		favoriteId: number,
		onProgress?: (progress: PlaylistSyncProgress) => void,
		expandMultiPage = false,
	): Promise<Result<number | undefined, FacadeError | BilibiliApiError>> {
		const syncKey = `favorite::${favoriteId}`
		if (this.syncingIds.has(syncKey)) {
			return err(createSyncTaskAlreadyRunningError())
		}
		const scopedLogger = log.extend('[Facade/SyncFavorite: ' + favoriteId + ']')
		try {
			this.syncingIds.add(syncKey)
			onProgress?.({
				message: '初始化同步任务...',
				stage: 'initializing',
			})
			scopedLogger.info('开始同步收藏夹', { favoriteId })
			scopedLogger.debug('syncFavorite', { favoriteId })

			return await runFavoriteSync(
				{
					api: this.bilibiliApi,
					playlistService: this.playlistService,
					trackService: this.trackService,
					artistService: this.artistService,
					db: this.db,
					logger: scopedLogger,
					onProgress,
					onHiddenVideos: (bvids) => {
						const tip = `Bilibili 隐藏了被 up 设置为仅自己可见的稿件，却没有更新索引，所以你会看到同步到的歌曲数量少于收藏夹实际显示的数量，具体隐藏稿件：${bvids.join(',')}`
						scopedLogger.warning(tip)
						toast.info(tip)
					},
					onSynced: (trackCount) => {
						void analyticsService.logPlaylistSync(
							'sync_bilibili',
							'favorite',
							trackCount,
						)
					},
				},
				favoriteId,
				expandMultiPage,
			)
		} finally {
			this.syncingIds.delete(syncKey)
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
		onProgress?: (progress: PlaylistSyncProgress) => void,
		expandMultiPage = false,
	) {
		switch (type) {
			case 'favorite': {
				return this.syncFavorite(remoteSyncId, onProgress, expandMultiPage)
			}
			case 'collection': {
				return this.syncCollection(remoteSyncId)
			}
			case 'series': {
				return this.syncSeries(remoteSyncId, onProgress)
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
