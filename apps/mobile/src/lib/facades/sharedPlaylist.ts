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
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { ResultAsync } from 'neverthrow'

import {
	setSharedPlaylistMembers,
	clearSharedPlaylistMembers,
} from '@/hooks/stores/useSharedPlaylistMembersStore'
import { api as bbplayerApiClient } from '@/lib/api/bbplayer/client'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { FacadeError, createFacadeError } from '@/lib/errors/facade'
import { createValidationError } from '@/lib/errors/service'
import { artistService, type ArtistService } from '@/lib/services/artistService'
import {
	playlistService,
	type PlaylistService,
} from '@/lib/services/playlistService'
import { trackService, type TrackService } from '@/lib/services/trackService'
import log from '@/utils/log'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
						artistName: schema.artists.name,
						artistRemoteId: schema.artists.remoteId,
						bvid: schema.bilibiliMetadata.bvid,
						cid: schema.bilibiliMetadata.cid,
					})
					.from(schema.playlistTracks)
					.innerJoin(
						schema.tracks,
						eq(schema.playlistTracks.trackId, schema.tracks.id),
					)
					.leftJoin(
						schema.artists,
						eq(schema.tracks.artistId, schema.artists.id),
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
							artist_name: t.artistName ?? undefined,
							artist_id: t.artistRemoteId ?? undefined,
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

				// 5. 将 shareId/role/syncAt 写回本地（事务保证原子性）
				await this.db.transaction(async (tx) => {
					const txPlaylist = this.playlistService.withDB(tx)
					const updateResult = await txPlaylist.updatePlaylistMetadata(
						localPlaylistId,
						{
							shareId,
							shareRole: 'owner',
							lastShareSyncAt: serverTime,
						},
					)
					if (updateResult.isErr()) throw updateResult.error
				})

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
	public subscribeToPlaylist(params: {
		shareId: string
		inviteCode?: string
	}): ResultAsync<
		{ localPlaylistId: number },
		ReturnType<typeof createFacadeError>
	> {
		return ResultAsync.fromPromise(
			(async () => {
				const { shareId, inviteCode } = params
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
					json: inviteCode ? { invite_code: inviteCode } : {},
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
					query: { since: '0' },
				})
				if (!changesResp.ok) {
					throw createFacadeError(
						'SharedPlaylistSubscribeFailed',
						`拉取歌单初始数据失败`,
						{ cause: await changesResp.json().catch(() => ({})) },
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

				const serverTime = (changesData as { server_time: number }).server_time

				// 4. 事务：创建本地歌单行 + 应用初始曲目 + 更新同步游标（原子）
				const localPlaylistId = await this.db.transaction(async (tx) => {
					const txPlaylist = this.playlistService.withDB(tx)
					const txTrack = this.trackService.withDB(tx)
					const txArtist = this.artistService.withDB(tx)

					const createResult = await txPlaylist.createPlaylist({
						title: meta?.title ?? '共享歌单',
						description: meta?.description ?? null,
						coverUrl: meta?.cover_url ?? null,
						type: 'local',
						shareId,
						shareRole: role,
						lastShareSyncAt: 0,
					})
					if (createResult.isErr()) throw createResult.error
					const id = createResult.value.id

					await this._applyPullResponse(id, shareId, changesData, tx, {
						playlistService: txPlaylist,
						trackService: txTrack,
						artistService: txArtist,
					})

					const syncResult = await txPlaylist.updatePlaylistMetadata(id, {
						lastShareSyncAt: serverTime,
					})
					if (syncResult.isErr()) throw syncResult.error

					return id
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
					// 全量拉取（since=0）— API 调用在事务外
					const changesResp = await this.api.playlists[':id'].changes.$get({
						param: { id: remote.id },
						query: { since: '0' },
					})
					if (!changesResp.ok) {
						logger.error('恢复歌单：拉取初始数据失败', { shareId: remote.id })
						continue
					}
					const changesData = await changesResp.json()
					const serverTime = (changesData as { server_time: number })
						.server_time

					// 事务：创建歌单行 + 应用曲目 + 更新同步游标（原子，单歌单独立回滚）
					try {
						await this.db.transaction(async (tx) => {
							const txPlaylist = this.playlistService.withDB(tx)
							const txTrack = this.trackService.withDB(tx)
							const txArtist = this.artistService.withDB(tx)

							const createResult = await txPlaylist.createPlaylist({
								title: remote.title,
								description: remote.description,
								coverUrl: remote.coverUrl,
								type: 'local',
								shareId: remote.id,
								shareRole: remote.role,
								lastShareSyncAt: 0,
							})
							if (createResult.isErr()) throw createResult.error
							const localId = createResult.value.id

							await this._applyPullResponse(
								localId,
								remote.id,
								changesData as Parameters<typeof this._applyPullResponse>[2],
								tx,
								{
									playlistService: txPlaylist,
									trackService: txTrack,
									artistService: txArtist,
								},
							)

							const syncResult = await txPlaylist.updatePlaylistMetadata(
								localId,
								{
									lastShareSyncAt: serverTime,
								},
							)
							if (syncResult.isErr()) throw syncResult.error
						})
						restored++
					} catch (e) {
						logger.error('恢复歌单失败', { shareId: remote.id, error: e })
					}
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
					query: { since: String(since) },
				})
				if (resp.status === 404) {
					throw createFacadeError('SharedPlaylistDeleted', '共享歌单已被删除', {
						data: { playlistId: localPlaylistId, shareId: playlist.shareId },
					})
				}
				if (!resp.ok) {
					throw createFacadeError(
						'SharedPlaylistPullFailed',
						`拉取变更失败：${resp.status}`,
					)
				}
				const data = await resp.json()

				const serverTime = (data as { server_time: number }).server_time

				// 3. 事务：应用变更 + 更新同步游标（原子）
				const applied = await this.db.transaction(async (tx) => {
					const txPlaylist = this.playlistService.withDB(tx)
					const txTrack = this.trackService.withDB(tx)
					const txArtist = this.artistService.withDB(tx)

					const n = await this._applyPullResponse(
						localPlaylistId,
						playlist.shareId!,
						data,
						tx,
						{
							playlistService: txPlaylist,
							trackService: txTrack,
							artistService: txArtist,
						},
					)

					const updateResult = await txPlaylist.updatePlaylistMetadata(
						localPlaylistId,
						{ lastShareSyncAt: serverTime },
					)
					if (updateResult.isErr()) throw updateResult.error

					return n
				})

				logger.info('pullChanges 完成', {
					localPlaylistId,
					applied,
					serverTime,
				})
				return { applied }
			})(),
			(e) => {
				if (e instanceof FacadeError && e.type === 'SharedPlaylistDeleted') {
					throw e
				}
				return createFacadeError(
					'SharedPlaylistPullFailed',
					'增量拉取歌单变更失败',
					{
						cause: e,
					},
				)
			},
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

				// 事务：删除或断开连接（原子）
				await this.db.transaction(async (tx) => {
					const txPlaylist = this.playlistService.withDB(tx)

					if (playlist.shareRole === 'subscriber') {
						// 订阅者：直接删除本地副本
						logger.info('unsubscribeFromPlaylist: 删除订阅副本', {
							localPlaylistId,
						})
						const deleteResult =
							await txPlaylist.deletePlaylist(localPlaylistId)
						if (deleteResult.isErr()) throw deleteResult.error
					} else {
						// owner/editor：断开连接但保留本地数据
						logger.info(
							'unsubscribeFromPlaylist: 断开共享连接（保留本地数据）',
							{
								localPlaylistId,
								role: playlist.shareRole,
							},
						)
						const updateResult = await txPlaylist.updatePlaylistMetadata(
							localPlaylistId,
							{
								shareId: null,
								shareRole: null,
								lastShareSyncAt: null,
							},
						)
						if (updateResult.isErr()) throw updateResult.error
					}
				})

				clearSharedPlaylistMembers(playlist.shareId)
			})(),
			(e) =>
				createFacadeError(
					'SharedPlaylistUnsubscribeFailed',
					'解除共享歌单订阅失败',
					{ cause: e },
				),
		)
	}

	public rotateEditorInviteCode(
		shareId: string,
	): ResultAsync<
		{ editorInviteCode: string },
		ReturnType<typeof createFacadeError>
	> {
		return ResultAsync.fromPromise(
			(async () => {
				const resp = await this.api.playlists[':id'].invite.rotate.$post({
					param: { id: shareId },
				})
				if (!resp.ok) {
					throw createFacadeError(
						'InviteCodeRotateFailed',
						`生成编辑者邀请码失败：${resp.status}`,
					)
				}
				const data = (await resp.json()) as {
					editor_invite_code: string
				}
				return { editorInviteCode: data.editor_invite_code }
			})(),
			(e) =>
				createFacadeError('InviteCodeRotateFailed', '生成编辑者邀请码失败', {
					cause: e,
				}),
		)
	}

	private async _applyPullResponse(
		localPlaylistId: number,
		shareId: string,
		data: {
			metadata?: {
				title?: string | null
				description?: string | null
				cover_url?: string | null
			} | null
			members?: Array<{
				mid: number
				name: string
				avatar_url?: string | null
				role: 'owner' | 'editor' | 'subscriber'
			}>
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
		conn: Tx,
		services: {
			playlistService: PlaylistService
			trackService: TrackService
			artistService: ArtistService
		},
	): Promise<number> {
		const { playlistService, trackService, artistService } = services
		let applied = 0

		// ---- 应用元数据更新 ----
		if (data.metadata) {
			const metaUpdate: Parameters<
				typeof playlistService.updatePlaylistMetadata
			>[1] = {}
			if (data.metadata.title != null) metaUpdate.title = data.metadata.title
			if (data.metadata.description !== undefined)
				metaUpdate.description = data.metadata.description
			if (data.metadata.cover_url !== undefined)
				metaUpdate.coverUrl = data.metadata.cover_url
			if (Object.keys(metaUpdate).length > 0) {
				const metaResult = await playlistService.updatePlaylistMetadata(
					localPlaylistId,
					metaUpdate,
				)
				if (metaResult.isErr()) throw metaResult.error
			}
		}

		if (Array.isArray(data.members)) {
			type narrowedMember = Omit<(typeof data.members)[number], 'role'> & {
				role: 'owner' | 'editor'
			}
			const members = data.members
				.filter((m) => m.role === 'owner' || m.role === 'editor')
				.map((m) => ({
					mid: Number(m.mid),
					name: m.name,
					avatarUrl: m.avatar_url ?? null,
					role: m.role,
				}))
				.filter((m) => Number.isFinite(m.mid) && !!m.name) as narrowedMember[]

			if (members.length > 0) {
				setSharedPlaylistMembers(shareId, members)
			} else {
				clearSharedPlaylistMembers(shareId)
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
					await artistService.findOrCreateManyRemoteArtists(artistsToCreate)
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

			const trackIdsResult = await trackService.findOrCreateManyTracks(
				trackPayloads,
				'bilibili',
			)
			if (trackIdsResult.isErr()) {
				logger.error('_applyPullResponse: 批量创建 track 失败', {
					error: trackIdsResult.error,
				})
			} else {
				// 用服务端 sort_key 直接 upsert playlist_tracks（conn 已是 tx 作用域）
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
					await conn
						.insert(schema.playlistTracks)
						.values(rows)
						.onConflictDoUpdate({
							target: [
								schema.playlistTracks.playlistId,
								schema.playlistTracks.trackId,
							],
							// 使用服务器下发的最新 sort_key 覆盖本地值，确保重排同步生效
							set: { sortKey: sql`excluded.sort_key` },
						})
					applied += rows.length
				}
			}
		}

		// ---- 应用 delete 变更 ----
		if (deleteChanges.length > 0) {
			const uniqueKeys = deleteChanges.map((c) => c.track_unique_key)
			const trackIdsResult =
				await trackService.findTrackIdsByUniqueKeys(uniqueKeys)
			if (trackIdsResult.isOk()) {
				const trackIds = Array.from(trackIdsResult.value.values())
				if (trackIds.length > 0) {
					await conn
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

		// ---- 重算并更新 itemCount ----
		if (applied > 0) {
			const [{ count }] = await conn
				.select({ count: sql<number>`count(*)` })
				.from(schema.playlistTracks)
				.where(eq(schema.playlistTracks.playlistId, localPlaylistId))
			await conn
				.update(schema.playlists)
				.set({ itemCount: count })
				.where(eq(schema.playlists.id, localPlaylistId))
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
