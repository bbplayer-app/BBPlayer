import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { errAsync, ResultAsync } from 'neverthrow'

import {
	bilibiliApi,
	type bilibiliApi as BilibiliApiService,
} from '@/lib/api/bilibili/api'
import db from '@/lib/db/db'
import type * as schema from '@/lib/db/schema'
import { createFacadeError } from '@/lib/errors/facade'
import { createValidationError } from '@/lib/errors/service'
import { artistService, type ArtistService } from '@/lib/services/artistService'
import {
	playlistService,
	type PlaylistService,
} from '@/lib/services/playlistService'
import { trackService, type TrackService } from '@/lib/services/trackService'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'
import log from '@/utils/log'

const logger = log.extend('Facade')

export class PlaylistFacade {
	constructor(
		private readonly trackService: TrackService,
		private readonly bilibiliApi: typeof BilibiliApiService,
		private readonly playlistService: PlaylistService,
		private readonly artistService: ArtistService,
		private readonly db: ExpoSQLiteDatabase<typeof schema>,
	) {}

	/**
	 * 复制一份 playlist，新复制的 playlist 类型为 local，且 author&remoteSyncId 为 null
	 * @param playlistId remote playlist 的 ID
	 * @param name 新的 local playlist 的名称
	 * @returns 如果成功，则为 local playlist 的 ID
	 */
	public async duplicatePlaylist(playlistId: number, name: string) {
		logger.info('开始复制播放列表', { playlistId, name })
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)

				const playlist = await playlistSvc.getPlaylistById(playlistId)
				if (playlist.isErr()) {
					throw playlist.error
				}
				const playlistMetadata = playlist.value

				if (!playlistMetadata)
					throw createValidationError(`未找到播放列表：${playlistId}`)

				logger.debug('step1: 获取播放列表', playlistMetadata.id)

				const localPlaylistResult = await playlistSvc.createPlaylist({
					title: name,
					description: playlistMetadata.description,
					coverUrl: playlistMetadata.coverUrl,
					authorId: null,
					type: 'local',
					remoteSyncId: null,
				})
				if (localPlaylistResult.isErr()) {
					throw localPlaylistResult.error
				}
				const localPlaylist = localPlaylistResult.value
				logger.debug('step2: 创建本地播放列表', localPlaylist)
				logger.info('创建本地播放列表成功', {
					localPlaylistId: localPlaylist.id,
				})

				const tracksMetadata = await playlistSvc.getPlaylistTracks(playlistId)
				if (tracksMetadata.isErr()) {
					throw tracksMetadata.error
				}
				const finalIds = tracksMetadata.value
					.filter((t) => {
						if (t.source === 'bilibili' && !t.bilibiliMetadata.videoIsValid)
							return false
						return true
					})
					.map((t) => t.id)
				logger.debug(
					'step3: 获取播放列表中的所有歌曲并清洗完成（对于 bilibili 音频，去除掉失效视频）',
				)

				const replaceResult = await playlistSvc.replacePlaylistAllTracks(
					localPlaylist.id,
					finalIds,
				)
				if (replaceResult.isErr()) {
					throw replaceResult.error
				}
				logger.debug('step4: 替换本地播放列表中的所有歌曲')
				logger.info('复制播放列表成功', {
					sourcePlaylistId: playlistId,
					targetPlaylistId: localPlaylist.id,
					trackCount: finalIds.length,
				})

				return localPlaylist.id
			}),
			(e) =>
				createFacadeError('PlaylistDuplicateFailed', '复制播放列表失败', {
					cause: e,
				}),
		)
	}

	/**
	 * 更新某个 Track 在本地播放列表中的归属。
	 * - 如需要会自动创建 Artist，并把其 id 关联到 Track。
	 * - 若 Track 不存在会自动创建。
	 * @returns 更新后的 Track 的 ID
	 */
	public async updateTrackLocalPlaylists(params: {
		toAddPlaylistIds: number[]
		toRemovePlaylistIds: number[]
		trackPayload: CreateTrackPayload
		artistPayload?: CreateArtistPayload | null
	}) {
		const {
			toAddPlaylistIds,
			toRemovePlaylistIds,
			trackPayload,
			artistPayload,
		} = params

		logger.info('开始更新 Track 在本地播放列表', {
			toAdd: toAddPlaylistIds.length,
			toRemove: toRemovePlaylistIds.length,
			source: trackPayload.source,
			title: trackPayload.title,
		})
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)
				const artistSvc = this.artistService.withDB(tx)

				// step1: 解析/创建 Artist（如需要）
				let finalArtistId: number | undefined =
					trackPayload.artistId ?? undefined
				if (finalArtistId === undefined && artistPayload) {
					const artistIdRes = await artistSvc.findOrCreateArtist(artistPayload)
					if (artistIdRes.isErr()) throw artistIdRes.error
					finalArtistId = artistIdRes.value.id
				}
				logger.debug('step1: 解析/创建 Artist 完成', finalArtistId ?? '(无)')

				// step2: 解析/创建 Track
				const trackRes = await trackSvc.findOrCreateTrack({
					...trackPayload,
					artistId: finalArtistId ?? undefined,
				})
				if (trackRes.isErr()) throw trackRes.error
				const trackId = trackRes.value.id
				logger.debug('step2: 解析/创建 Track 完成', trackId)

				// step3: 执行增删
				for (const pid of toAddPlaylistIds) {
					// oxlint-disable-next-line no-await-in-loop
					const r = await playlistSvc.addManyTracksToLocalPlaylist(pid, [
						trackId,
					])
					if (r.isErr()) throw r.error
				}
				for (const pid of toRemovePlaylistIds) {
					// oxlint-disable-next-line no-await-in-loop
					const r = await playlistSvc.batchRemoveTracksFromLocalPlaylist(pid, [
						trackId,
					])
					if (r.isErr()) throw r.error
				}
				logger.debug('step3: 更新本地播放列表完成', {
					added: toAddPlaylistIds,
					removed: toRemovePlaylistIds,
				})

				logger.debug('更新 Track 在本地播放列表成功')
				logger.info('更新 Track 在本地播放列表成功', {
					trackId,
					added: toAddPlaylistIds.length,
					removed: toRemovePlaylistIds.length,
				})
				return trackId
			}),
			(e) =>
				createFacadeError(
					'UpdateTrackLocalPlaylistsFailed',
					'更新 Track 在本地播放列表失败',
					{ cause: e },
				),
		)
	}

	/**
	 * 批量添加 tracks 到本地播放列表
	 * @param playlistId
	 * @param payloads 应包含 track 和 artist，**artist 只能为 remote 来源**
	 * @returns
	 */
	public async batchAddTracksToLocalPlaylist(
		playlistId: number,
		payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[],
	) {
		logger.info('开始批量添加 tracks 到本地播放列表', {
			playlistId,
			count: payloads.length,
		})
		for (const payload of payloads) {
			if (payload.artist.source === 'local') {
				return errAsync(
					createValidationError(
						'批量添加 tracks 到本地播放列表时，artist 只能为 remote 来源',
					),
				)
			}
		}
		return ResultAsync.fromPromise(
			(async () => {
				const playlistSvc = this.playlistService.withDB(this.db)
				const trackSvc = this.trackService.withDB(this.db)
				const artistSvc = this.artistService.withDB(this.db)

				const artistResult = await artistSvc.findOrCreateManyRemoteArtists(
					payloads.map((p) => p.artist),
				)
				if (artistResult.isErr()) {
					throw artistResult.error
				}
				const artistMap = artistResult.value
				logger.debug('step1: 批量创建 artist 完成')

				const trackResult = await trackSvc.findOrCreateManyTracks(
					payloads.map((p) => ({
						...p.track,
						artistId: artistMap.get(p.artist.remoteId!)?.id,
					})),
					'bilibili',
				)
				if (trackResult.isErr()) throw trackResult.error
				const trackIds = Array.from(trackResult.value.values())
				logger.debug('step2: 批量创建 track 完成')

				const addResult = await playlistSvc.addManyTracksToLocalPlaylist(
					playlistId,
					trackIds,
				)
				if (addResult.isErr()) throw addResult.error
				logger.debug('step3: 批量将 track 添加到本地播放列表完成')
				logger.info('批量添加 tracks 到本地播放列表成功', {
					playlistId,
					added: trackIds.length,
				})

				return trackIds
			})(),
			(e) =>
				createFacadeError(
					'BatchAddTracksToLocalPlaylistFailed',
					'批量添加 tracks 到本地播放列表失败',
					{ cause: e },
				),
		)
	}

	/**
	 * 将播放队列保存为新的播放列表
	 * @param name 播放列表名称
	 * @param uniqueKeys 队列中的 track uniqueKeys
	 */
	public async saveQueueAsPlaylist(name: string, uniqueKeys: string[]) {
		logger.info('开始将队列保存为播放列表', {
			name,
			trackCount: uniqueKeys.length,
		})
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)

				// 1. 创建播放列表
				const playlistRes = await playlistSvc.createPlaylist({
					title: name,
					type: 'local',
					authorId: null,
					remoteSyncId: null,
				})
				if (playlistRes.isErr()) throw playlistRes.error
				const playlist = playlistRes.value

				// 2. 验证所有 tracks 在本地存在，并获取 ID
				const distinctKeys = Array.from(new Set(uniqueKeys))

				const findRes = await trackSvc.findTrackIdsByUniqueKeys(distinctKeys)
				if (findRes.isErr()) throw findRes.error
				const foundMap = findRes.value

				const trackIds: number[] = []
				for (const key of distinctKeys) {
					const id = foundMap.get(key)
					if (id === undefined) {
						// 理论上不应该发生，因为进入播放队列的歌曲必须在本地 DB 有记录
						logger.error(`保存队列时发现缺失的 track: ${key}`)
						throw createFacadeError(
							'PlaylistCreateFailed',
							`无法保存队列，发现未入库的歌曲 (ID: ${key})，请向开发者反馈`,
						)
					}
					trackIds.push(id)
				}

				// 3. 批量添加到播放列表
				if (trackIds.length > 0) {
					const addRes = await playlistSvc.addManyTracksToLocalPlaylist(
						playlist.id,
						trackIds,
					)
					if (addRes.isErr()) throw addRes.error
				}

				return playlist.id
			}),
			(e) =>
				createFacadeError('PlaylistCreateFailed', '保存队列为播放列表失败', {
					cause: e,
				}),
		)
	}
}

export const playlistFacade = new PlaylistFacade(
	trackService,
	bilibiliApi,
	playlistService,
	artistService,
	db,
)
