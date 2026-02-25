/**
 * SharedPlaylistFacade — 歌单云同步协调层
 *
 * 职责：协调后端 API 调用与本地 SQLite 写入，处理共享歌单生命周期：
 *   - enableSharing      本地歌单 → 共享歌单（上传初始曲目，保存 shareId）
 *   - subscribeToPlaylist 通过分享链接订阅歌单（创建本地副本 + 全量拉取）
 *   - restoreFromCloud   换设备后从云端恢复参与的所有歌单
 *   - pullChanges        增量拉取单个歌单的最新变更并应用到本地 DB
 *   - unsubscribeFromPlaylist 解除订阅/断开共享连接
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { ResultAsync } from 'neverthrow'

import { api as bbplayerApiClient } from '@/lib/api/bbplayer/client'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { createFacadeError } from '@/lib/errors/facade'
import { createValidationError } from '@/lib/errors/service'
import { artistService, type ArtistService } from '@/lib/services/artistService'
import {
	playlistService,
	type PlaylistService,
} from '@/lib/services/playlistService'
import { trackService, type TrackService } from '@/lib/services/trackService'
import log from '@/utils/log'

const logger = log.extend('SharedPlaylistFacade')

export class SharedPlaylistFacade {
	constructor(
		private readonly db: ExpoSQLiteDatabase<typeof schema>,
		private readonly playlistService: PlaylistService,
		private readonly trackService: TrackService,
		private readonly artistService: ArtistService,
		private readonly api: typeof bbplayerApiClient,
	) {}

	// ---------------------------------------------------------------------------
	// enableSharing — 将本地歌单升级为共享歌单
	// ---------------------------------------------------------------------------
	/**
	 * 将一个现有的本地歌单发布为共享歌单。
	 * 步骤：读取本地曲目 → POST /api/playlists → 将 shareId 写回本地。
	 * @param localPlaylistId 本地歌单 ID
	 */
	public enableSharing(
		localPlaylistId: number,
	): ResultAsync<{ shareId: string }, ReturnType<typeof createFacadeError>> {
		return ResultAsync.fromPromise(
			(async () => {
				// 1. 读取本地歌单元数据
				const playlistResult =
					await this.playlistService.getPlaylistById(localPlaylistId)
				if (playlistResult.isErr()) throw playlistResult.error
				const playlist = playlistResult.value
				if (!playlist) {
					throw createValidationError(`找不到歌单：${localPlaylistId}`)
				}
				if (playlist.shareId) {
					// 已经是共享歌单，直接返回
					return { shareId: playlist.shareId }
				}

				// 2. 读取曲目及其 sort_key（直接联表查询，preserving fractional sort_key）
				const trackLinks = await this.db
					.select({
						sortKey: schema.playlistTracks.sortKey,
						uniqueKey: schema.tracks.uniqueKey,
						title: schema.tracks.title,
						coverUrl: schema.tracks.coverUrl,
						duration: schema.tracks.duration,
						artistId: schema.tracks.artistId,
						bvid: schema.bilibiliMetadata.bvid,
						cid: schema.bilibiliMetadata.cid,
					})
					.from(schema.playlistTracks)
					.innerJoin(
						schema.tracks,
						eq(schema.playlistTracks.trackId, schema.tracks.id),
					)
					.leftJoin(
						schema.bilibiliMetadata,
						eq(schema.playlistTracks.trackId, schema.bilibiliMetadata.trackId),
					)
					.where(
						and(
							eq(schema.playlistTracks.playlistId, localPlaylistId),
							eq(schema.tracks.source, 'bilibili'),
						),
					)
				logger.debug('enableSharing: 读取曲目', trackLinks.length)

				// 3. 构造初始曲目上传格式
				const initialTracks = trackLinks
					.filter((t) => t.bvid)
					.map((t) => ({
						track: {
							unique_key: t.uniqueKey,
							title: t.title,
							cover_url: t.coverUrl ?? undefined,
							duration: t.duration ?? undefined,
							bilibili_bvid: t.bvid!,
							bilibili_cid: t.cid ? String(t.cid) : undefined,
						},
						sort_key: t.sortKey,
					}))

				// 4. POST /api/playlists
				const resp = await this.api.playlists.$post({
					json: {
						title: playlist.title,
						description: playlist.description ?? undefined,
						cover_url: playlist.coverUrl ?? undefined,
						tracks: initialTracks,
					},
				})
				if (!resp.ok) {
					const errBody = await resp.json().catch(() => ({}))
					throw createFacadeError(
						'SharedPlaylistEnableFailed',
						`创建共享歌单失败：${resp.status}`,
						{ cause: errBody },
					)
				}
				const { playlist: remotePlaylist } = await resp.json()
				const shareId: string = remotePlaylist.id
				const serverTime = Date.now()

				// 5. 将 shareId/role/syncAt 写回本地
				const updateResult = await this.playlistService.updatePlaylistMetadata(
					localPlaylistId,
					{
						shareId,
						shareRole: 'owner',
						lastShareSyncAt: serverTime,
					},
				)
				if (updateResult.isErr()) throw updateResult.error

				logger.info('enableSharing 完成', { localPlaylistId, shareId })
				return { shareId }
			})(),
			(e) =>
				createFacadeError('SharedPlaylistEnableFailed', '启用共享歌单失败', {
					cause: e,
				}),
		)
	}

	// ---------------------------------------------------------------------------
	// subscribeToPlaylist — 通过分享链接订阅共享歌单
	// ---------------------------------------------------------------------------
	/**
	 * 通过 shareId（分享链接中的 UUID）订阅一个共享歌单。
	 * 步骤：POST subscribe → 创建本地歌单行 → 全量拉取（since=0）。
	 * @param shareId 后端共享歌单 UUID
	 */
	public subscribeToPlaylist(
		shareId: string,
	): ResultAsync<
		{ localPlaylistId: number },
		ReturnType<typeof createFacadeError>
	> {
		return ResultAsync.fromPromise(
			(async () => {
				// 1. 检查是否已有本地副本
				const existing =
					await this.playlistService.findPlaylistByShareId(shareId)
				if (existing.isOk() && existing.value) {
					logger.info('subscribeToPlaylist: 已存在本地副本', {
						shareId,
						id: existing.value.id,
					})
					return { localPlaylistId: existing.value.id }
				}

				// 2. 通知后端订阅
				const subResp = await this.api.playlists[':id'].subscribe.$post({
					param: { id: shareId },
				})
				if (!subResp.ok && subResp.status !== 201) {
					const errBody = await subResp.json().catch(() => ({}))
					throw createFacadeError(
						'SharedPlaylistSubscribeFailed',
						`订阅歌单失败：${subResp.status}`,
						{ cause: errBody },
					)
				}
				const subData = await subResp.json()
				const role = (subData as { role: string }).role as
					| 'owner'
					| 'editor'
					| 'subscriber'

				// 3. 从后端获取元数据（通过 since=0 拿到 metadata 字段）
				const changesResp = await this.api.playlists[':id'].changes.$get({
					param: { id: shareId },
					query: { since: 0 },
				})
				if (!changesResp.ok) {
					throw createFacadeError(
						'SharedPlaylistSubscribeFailed',
						`拉取歌单初始数据失败：${changesResp.status}`,
					)
				}
				const changesData = await changesResp.json()
				const meta = (
					changesData as {
						metadata: {
							title?: string
							description?: string
							cover_url?: string
						} | null
					}
				).metadata

				// 4. 创建本地歌单行
				const createResult = await this.playlistService.createPlaylist({
					title: meta?.title ?? '共享歌单',
					description: meta?.description ?? null,
					coverUrl: meta?.cover_url ?? null,
					type: 'local',
					shareId,
					shareRole: role,
					lastShareSyncAt: 0,
				})
				if (createResult.isErr()) throw createResult.error
				const localPlaylistId = createResult.value.id

				// 5. 应用初始曲目变更
				await this._applyPullResponse(
					localPlaylistId,
					changesData as Parameters<typeof this._applyPullResponse>[1],
				)

				// 6. 更新 lastShareSyncAt
				const serverTime = (changesData as { server_time: number }).server_time
				await this.playlistService.updatePlaylistMetadata(localPlaylistId, {
					lastShareSyncAt: serverTime,
				})

				logger.info('subscribeToPlaylist 完成', { shareId, localPlaylistId })
				return { localPlaylistId }
			})(),
			(e) =>
				createFacadeError('SharedPlaylistSubscribeFailed', '订阅共享歌单失败', {
					cause: e,
				}),
		)
	}

	// ---------------------------------------------------------------------------
	// restoreFromCloud — 换设备后从云端恢复所有参与歌单
	// ---------------------------------------------------------------------------
	/**
	 * 登录后调用：拉取用户参与的所有共享歌单，与本地对比，补全缺失的歌单行。
	 */
	public restoreFromCloud(): ResultAsync<
		{ restored: number },
		ReturnType<typeof createFacadeError>
	> {
		return ResultAsync.fromPromise(
			(async () => {
				// 1. 获取云端歌单列表
				const resp = await this.api.me.playlists.$get()
				if (!resp.ok) {
					throw createFacadeError(
						'SharedPlaylistRestoreFailed',
						`获取云端歌单列表失败：${resp.status}`,
					)
				}
				const { playlists: remotePlaylists } = (await resp.json()) as {
					playlists: Array<{
						id: string
						title: string
						description: string | null
						coverUrl: string | null
						role: 'owner' | 'editor' | 'subscriber'
					}>
				}

				// 2. 获取本地已存在的 shareId 集合
				const localSharedResult =
					await this.playlistService.getSharedPlaylists()
				if (localSharedResult.isErr()) throw localSharedResult.error
				const localShareIds = new Set(
					localSharedResult.value.map((p) => p.shareId).filter(Boolean),
				)

				// 3. 差异对比 → 只处理本地缺失的歌单
				const missing = remotePlaylists.filter(
					(rp) => !localShareIds.has(rp.id),
				)
				logger.info('restoreFromCloud: 需恢复的歌单数', missing.length)

				let restored = 0
				for (const remote of missing) {
					// oxlint-disable-next-line no-await-in-loop
					const createResult = await this.playlistService.createPlaylist({
						title: remote.title,
						description: remote.description,
						coverUrl: remote.coverUrl,
						type: 'local',
						shareId: remote.id,
						shareRole: remote.role,
						lastShareSyncAt: 0,
					})
					if (createResult.isErr()) {
						logger.error('恢复歌单失败', {
							shareId: remote.id,
							error: createResult.error,
						})
						continue
					}
					const localId = createResult.value.id

					// 全量拉取（since=0）
					// oxlint-disable-next-line no-await-in-loop
					const pullResult = await this.pullChanges(localId)
					if (pullResult.isErr()) {
						logger.error('恢复歌单全量拉取失败', {
							shareId: remote.id,
							error: pullResult.error,
						})
						continue
					}
					restored++
				}

				logger.info('restoreFromCloud 完成', { restored })
				return { restored }
			})(),
			(e) =>
				createFacadeError('SharedPlaylistRestoreFailed', '从云端恢复歌单失败', {
					cause: e,
				}),
		)
	}

	// ---------------------------------------------------------------------------
	// pullChanges — 增量拉取单个歌单的最新变更
	// ---------------------------------------------------------------------------
	/**
	 * 拉取指定本地歌单的增量变更并应用到本地 DB。
	 * 以 `playlist.lastShareSyncAt` 作为 `since` 游标，拉取后更新为 `server_time`。
	 * @param localPlaylistId 本地歌单 ID
	 */
	public pullChanges(
		localPlaylistId: number,
	): ResultAsync<{ applied: number }, ReturnType<typeof createFacadeError>> {
		return ResultAsync.fromPromise(
			(async () => {
				// 1. 获取本地歌单的 shareId 和 lastShareSyncAt
				const playlistResult =
					await this.playlistService.getPlaylistById(localPlaylistId)
				if (playlistResult.isErr()) throw playlistResult.error
				const playlist = playlistResult.value
				if (!playlist?.shareId) {
					throw createValidationError(
						`歌单 ${localPlaylistId} 没有 shareId，无法拉取`,
					)
				}

				const since = playlist.lastShareSyncAt
					? playlist.lastShareSyncAt.getTime()
					: 0

				// 2. GET /api/playlists/:id/changes?since=<ms>
				const resp = await this.api.playlists[':id'].changes.$get({
					param: { id: playlist.shareId },
					query: { since },
				})
				if (!resp.ok) {
					throw createFacadeError(
						'SharedPlaylistPullFailed',
						`拉取变更失败：${resp.status}`,
					)
				}
				const data = await resp.json()

				// 3. 应用变更
				const applied = await this._applyPullResponse(localPlaylistId, data)

				// 4. 更新 lastShareSyncAt = server_time
				const serverTime = (data as { server_time: number }).server_time
				const updateResult = await this.playlistService.updatePlaylistMetadata(
					localPlaylistId,
					{ lastShareSyncAt: serverTime },
				)
				if (updateResult.isErr()) throw updateResult.error

				logger.info('pullChanges 完成', {
					localPlaylistId,
					applied,
					serverTime,
				})
				return { applied }
			})(),
			(e) =>
				createFacadeError('SharedPlaylistPullFailed', '增量拉取歌单变更失败', {
					cause: e,
				}),
		)
	}

	// ---------------------------------------------------------------------------
	// unsubscribeFromPlaylist — 解除订阅 / 断开共享连接
	// ---------------------------------------------------------------------------
	/**
	 * 解除本地歌单与共享歌单的关联。
	 * - subscriber：删除本地歌单副本（连带曲目一起删除）
	 * - owner/editor：仅清除 shareId/shareRole/lastShareSyncAt，保留本地数据
	 * @param localPlaylistId 本地歌单 ID
	 */
	public unsubscribeFromPlaylist(
		localPlaylistId: number,
	): ResultAsync<void, ReturnType<typeof createFacadeError>> {
		return ResultAsync.fromPromise(
			(async () => {
				const playlistResult =
					await this.playlistService.getPlaylistById(localPlaylistId)
				if (playlistResult.isErr()) throw playlistResult.error
				const playlist = playlistResult.value
				if (!playlist) {
					throw createValidationError(`找不到歌单：${localPlaylistId}`)
				}
				if (!playlist.shareId) {
					// 纯本地歌单，无需操作
					return
				}

				if (playlist.shareRole === 'subscriber') {
					// 订阅者：直接删除本地副本
					logger.info('unsubscribeFromPlaylist: 删除订阅副本', {
						localPlaylistId,
					})
					const deleteResult =
						await this.playlistService.deletePlaylist(localPlaylistId)
					if (deleteResult.isErr()) throw deleteResult.error
				} else {
					// owner/editor：断开连接但保留本地数据
					logger.info('unsubscribeFromPlaylist: 断开共享连接（保留本地数据）', {
						localPlaylistId,
						role: playlist.shareRole,
					})
					const updateResult =
						await this.playlistService.updatePlaylistMetadata(localPlaylistId, {
							shareId: null,
							shareRole: null,
							lastShareSyncAt: null,
						})
					if (updateResult.isErr()) throw updateResult.error
				}
			})(),
			(e) =>
				createFacadeError(
					'SharedPlaylistUnsubscribeFailed',
					'解除共享歌单订阅失败',
					{ cause: e },
				),
		)
	}

	// ---------------------------------------------------------------------------
	// 私有辅助：将后端 changes 响应应用到本地 playlistTracks
	// ---------------------------------------------------------------------------
	private async _applyPullResponse(
		localPlaylistId: number,
		data: {
			metadata?: {
				title?: string | null
				description?: string | null
				cover_url?: string | null
			} | null
			tracks: Array<
				| {
						op: 'upsert'
						track: {
							unique_key: string
							title: string
							artist_name?: string
							artist_id?: string
							cover_url?: string
							duration?: number
							bilibili_bvid: string
							bilibili_cid?: string
						}
						sort_key: string
						updated_at: number
				  }
				| {
						op: 'delete'
						track_unique_key: string
						deleted_at: number
				  }
			>
			server_time?: number
		},
	): Promise<number> {
		let applied = 0

		// ---- 应用元数据更新 ----
		if (data.metadata) {
			const metaUpdate: Parameters<
				typeof this.playlistService.updatePlaylistMetadata
			>[1] = {}
			if (data.metadata.title != null) metaUpdate.title = data.metadata.title
			if (data.metadata.description !== undefined)
				metaUpdate.description = data.metadata.description
			if (data.metadata.cover_url !== undefined)
				metaUpdate.coverUrl = data.metadata.cover_url
			if (Object.keys(metaUpdate).length > 0) {
				await this.playlistService.updatePlaylistMetadata(
					localPlaylistId,
					metaUpdate,
				)
			}
		}

		if (!data.tracks.length) return applied

		const upsertChanges = data.tracks.filter(
			(t): t is Extract<(typeof data.tracks)[number], { op: 'upsert' }> =>
				t.op === 'upsert',
		)
		const deleteChanges = data.tracks.filter(
			(t): t is Extract<(typeof data.tracks)[number], { op: 'delete' }> =>
				t.op === 'delete',
		)

		// ---- 应用 upsert 变更 ----
		if (upsertChanges.length > 0) {
			// 批量找或创建 artist
			const artistMap = new Map<string, number>() // artistId(mid str) → local artist DB id
			const artistsToCreate = upsertChanges
				.filter((c) => c.track.artist_name && c.track.artist_id)
				.map((c) => ({
					name: c.track.artist_name!,
					source: 'bilibili' as const,
					remoteId: c.track.artist_id!,
				}))
			if (artistsToCreate.length > 0) {
				const artistResult =
					await this.artistService.findOrCreateManyRemoteArtists(
						artistsToCreate,
					)
				if (artistResult.isOk()) {
					for (const [remoteId, artist] of artistResult.value.entries()) {
						artistMap.set(remoteId, artist.id)
					}
				}
			}

			// 批量找或创建 track
			const trackPayloads = upsertChanges.map((c) => {
				const cidNum = c.track.bilibili_cid
					? Number(c.track.bilibili_cid)
					: undefined
				const isMultiPage = !!c.track.bilibili_cid
				return {
					title: c.track.title,
					coverUrl: c.track.cover_url,
					duration: c.track.duration ?? 0,
					source: 'bilibili' as const,
					artistId: c.track.artist_id
						? artistMap.get(c.track.artist_id)
						: undefined,
					bilibiliMetadata: {
						bvid: c.track.bilibili_bvid,
						cid: cidNum ?? null,
						isMultiPage,
						videoIsValid: true,
					},
				}
			})

			const trackIdsResult = await this.trackService.findOrCreateManyTracks(
				trackPayloads,
				'bilibili',
			)
			if (trackIdsResult.isErr()) {
				logger.error('_applyPullResponse: 批量创建 track 失败', {
					error: trackIdsResult.error,
				})
			} else {
				// 用服务端 sort_key 直接 upsert playlist_tracks
				const trackIdMap = trackIdsResult.value
				const rows = upsertChanges
					.map((c) => {
						const trackId = trackIdMap.get(c.track.unique_key)
						if (!trackId) return null
						return {
							playlistId: localPlaylistId,
							trackId,
							sortKey: c.sort_key,
						}
					})
					.filter((r): r is NonNullable<typeof r> => r !== null)

				if (rows.length > 0) {
					await this.db
						.insert(schema.playlistTracks)
						.values(rows)
						.onConflictDoUpdate({
							target: [
								schema.playlistTracks.playlistId,
								schema.playlistTracks.trackId,
							],
							set: { sortKey: schema.playlistTracks.sortKey },
						})

					// 更新 itemCount
					const currentCount = await this.db
						.select({ count: schema.playlists.itemCount })
						.from(schema.playlists)
						.where(eq(schema.playlists.id, localPlaylistId))
					const realCount = await this.db
						.select({ c: schema.playlistTracks.trackId })
						.from(schema.playlistTracks)
						.where(eq(schema.playlistTracks.playlistId, localPlaylistId))
					if (currentCount[0]?.count !== realCount.length) {
						await this.db
							.update(schema.playlists)
							.set({ itemCount: realCount.length })
							.where(eq(schema.playlists.id, localPlaylistId))
					}

					applied += rows.length
				}
			}
		}

		// ---- 应用 delete 变更 ----
		if (deleteChanges.length > 0) {
			const uniqueKeys = deleteChanges.map((c) => c.track_unique_key)
			const trackIdsResult =
				await this.trackService.findTrackIdsByUniqueKeys(uniqueKeys)
			if (trackIdsResult.isOk()) {
				const trackIds = Array.from(trackIdsResult.value.values())
				if (trackIds.length > 0) {
					await this.db
						.delete(schema.playlistTracks)
						.where(
							and(
								eq(schema.playlistTracks.playlistId, localPlaylistId),
								inArray(schema.playlistTracks.trackId, trackIds),
							),
						)
					applied += trackIds.length
				}
			}
		}

		return applied
	}
}

export const sharedPlaylistFacade = new SharedPlaylistFacade(
	db,
	playlistService,
	trackService,
	artistService,
	bbplayerApiClient,
)
