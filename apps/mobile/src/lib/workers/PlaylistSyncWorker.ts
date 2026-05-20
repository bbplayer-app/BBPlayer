import { and, asc, eq, inArray } from 'drizzle-orm'

import useAppStore from '@/hooks/stores/useAppStore'
import { api as bbplayerApi } from '@/lib/api/bbplayer/client'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { playlistService } from '@/lib/services/playlistService'
import log from '@/utils/log'

const logger = log.extend('PlaylistSyncWorker')

type QueueRow = typeof schema.playlistSyncQueue.$inferSelect

type TrackMeta = {
	trackId: number
	uniqueKey: string
	title: string
	artistName?: string | null
	artistId?: string | null
	coverUrl?: string | null
	duration?: number | null
	bvid?: string | null
	cid?: number | null
	sortKey?: string | null
}

/**
 * 单例队列消费器：将 playlist_sync_queue 中的记录批量推送到后端。
 */
class PlaylistSyncWorker {
	private isRunning = false
	private runAgain = false

	triggerSync() {
		void this.syncAllPlaylists()
	}

	/**
	 * 应用启动时调用：将上次被意外中断（状态为 syncing 或 pending 但未被消费）的记录
	 * 重置为 pending，然后触发同步。
	 * - syncing：进程被杀死时正在上传，需要重置
	 * - pending：进程被杀死时还没轮到，triggerSync 会正常消费，无需额外处理
	 */
	async recoverStuckRows(): Promise<void> {
		try {
			// 仅需处理 syncing，pending 本来就可以被 triggerSync 消费
			const stuck = await db
				.select({ id: schema.playlistSyncQueue.id })
				.from(schema.playlistSyncQueue)
				.where(eq(schema.playlistSyncQueue.status, 'syncing'))
			if (stuck.length > 0) {
				await db
					.update(schema.playlistSyncQueue)
					.set({ status: 'pending' })
					.where(eq(schema.playlistSyncQueue.status, 'syncing'))
				logger.info(
					`恢复了 ${stuck.length} 条中断的同步记录（syncing → pending）`,
				)
			}
		} catch (error) {
			logger.error('recoverStuckRows 失败', { error })
		}
		// 无论是否有 syncing 记录，都触发一次以消费所有 pending 行
		this.triggerSync()
	}

	private async syncAllPlaylists(): Promise<void> {
		if (!useAppStore.getState().bbplayerToken) {
			logger.debug('未登录 BBPlayer 账号，暂停共享歌单同步')
			return
		}

		if (this.isRunning) {
			this.runAgain = true
			return
		}

		this.isRunning = true
		try {
			do {
				this.runAgain = false
				const playlistRows = await db
					.select({ playlistId: schema.playlistSyncQueue.playlistId })
					.from(schema.playlistSyncQueue)
					.where(eq(schema.playlistSyncQueue.status, 'pending'))
					.groupBy(schema.playlistSyncQueue.playlistId)

				for (const row of playlistRows) {
					await this.syncSinglePlaylist(row.playlistId)
				}

				// 每轮处理完后清理已完成的记录，避免表无限膨胀
				await db
					.delete(schema.playlistSyncQueue)
					.where(eq(schema.playlistSyncQueue.status, 'done'))
			} while (this.runAgain)
		} finally {
			this.isRunning = false
		}
	}

	private async syncSinglePlaylist(playlistId: number): Promise<void> {
		// 读取待处理队列
		const queueRows = await db
			.select()
			.from(schema.playlistSyncQueue)
			.where(
				and(
					eq(schema.playlistSyncQueue.playlistId, playlistId),
					eq(schema.playlistSyncQueue.status, 'pending'),
				),
			)
			.orderBy(
				asc(schema.playlistSyncQueue.operationAt),
				asc(schema.playlistSyncQueue.id),
			)

		if (queueRows.length === 0) return

		const playlistRes = await playlistService.getPlaylistById(playlistId)
		if (playlistRes.isErr()) {
			// 数据库查询异常（非歌单不存在），保留队列行等待下次重试
			logger.error('syncSinglePlaylist: 读取歌单失败', {
				playlistId,
				error: playlistRes.error,
			})
			return
		}

		const playlist = playlistRes.value
		if (!playlist?.shareId || !playlist.shareRole) {
			// 歌单不存在或未开启分享，永久无效，直接清理
			await this.deleteRows(queueRows.map((r) => r.id))
			return
		}
		if (playlist.shareRole === 'subscriber') {
			// 订阅者无写权限，永久无效，直接清理
			await this.deleteRows(queueRows.map((r) => r.id))
			return
		}

		const metadataOps = queueRows.filter(
			(r) => r.operation === 'update_metadata',
		)
		const trackOps = queueRows.filter((r) => r.operation !== 'update_metadata')

		if (trackOps.length > 0) {
			await this.pushTrackChanges(playlist.shareId, playlistId, trackOps)
		}

		if (metadataOps.length > 0) {
			if (playlist.shareRole !== 'owner') {
				// 非 owner 无法修改元数据，永久无效，直接清理
				await this.deleteRows(metadataOps.map((r) => r.id))
			} else {
				await this.pushMetadataChanges(playlist.shareId, metadataOps)
			}
		}
	}

	private async pushTrackChanges(
		shareId: string,
		playlistId: number,
		rows: QueueRow[],
	): Promise<void> {
		const trackIds = this.collectTrackIds(rows)

		if (trackIds.size === 0) {
			// payload 损坏，无法解析出任何 trackId，永久无效，直接清理
			await this.deleteRows(rows.map((r) => r.id))
			return
		}

		const metaMap = await this.fetchTrackMetadata(playlistId, [...trackIds])

		const { changes, validRowIds, invalidRowIds } = this.mapTrackChangesToApi(
			rows,
			metaMap,
		)

		if (invalidRowIds.length > 0) {
			// payload 损坏或对应 track 已被删除，永久无效，直接清理
			await this.deleteRows(invalidRowIds)
		}

		if (changes.length === 0) return

		// operation_at 升序，确保与服务器 LWW 对齐
		changes.sort((a, b) => a.operation_at - b.operation_at)

		// 发起请求前先标记为 syncing，避免重启后重复提交
		if (validRowIds.size > 0) {
			await this.markRows([...validRowIds], 'syncing')
		}

		try {
			const resp = await bbplayerApi.playlists[':id'].changes.$post({
				param: { id: shareId },
				json: { changes },
			})
			if (!resp.ok) {
				const body = await resp.json().catch(() => ({}))
				throw new Error(`API ${resp.status}` + (JSON.stringify(body) ?? ''))
			}
			const data = (await resp.json()) as { applied_at?: number }
			await db.transaction(async (tx) => {
				if (validRowIds.size > 0) {
					await tx
						.update(schema.playlistSyncQueue)
						.set({ status: 'done' })
						.where(inArray(schema.playlistSyncQueue.id, [...validRowIds]))
				}

				if (typeof data.applied_at === 'number') {
					await tx
						.update(schema.playlists)
						.set({ lastShareSyncAt: new Date(data.applied_at) })
						.where(eq(schema.playlists.id, playlistId))
				}
			})
		} catch (error) {
			logger.error('pushTrackChanges 失败', {
				playlistId,
				error,
			})
			await this.markRows([...validRowIds], 'failed')
		}
	}

	private collectTrackIds(rows: QueueRow[]): Set<number> {
		const trackIds = new Set<number>()
		for (const row of rows) {
			const payload = this.parsePayload(row.payload)
			if (row.operation === 'add_tracks') {
				;(payload.trackIds as number[] | undefined)?.forEach((id) =>
					trackIds.add(id),
				)
			} else if (row.operation === 'remove_tracks') {
				;(payload.removedTrackIds as number[] | undefined)?.forEach((id) =>
					trackIds.add(id),
				)
			} else if (row.operation === 'reorder_track') {
				if (typeof payload.trackId === 'number') trackIds.add(payload.trackId)
			}
		}
		return trackIds
	}

	private mapTrackChangesToApi(
		rows: QueueRow[],
		metaMap: Map<number, TrackMeta>,
	) {
		type SyncChange =
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
					operation_at: number
			  }
			| {
					op: 'remove'
					track_unique_key: string
					operation_at: number
			  }
			| {
					op: 'reorder'
					track_unique_key: string
					sort_key: string
					operation_at: number
			  }

		const invalidRowIds: number[] = []
		const validRowIds = new Set<number>()
		const changes: SyncChange[] = []

		for (const row of rows) {
			const payload = this.parsePayload(row.payload)
			let rowValid = true
			const rowChanges: SyncChange[] = []

			if (row.operation === 'add_tracks') {
				const ids = (payload.trackIds as number[]) || []
				if (ids.length === 0) rowValid = false
				for (const tid of ids) {
					const meta = metaMap.get(tid)
					if (!meta || !meta.sortKey || !meta.bvid) {
						rowValid = false
						break
					}
					rowChanges.push({
						op: 'upsert',
						track: {
							unique_key: meta.uniqueKey,
							title: meta.title,
							artist_name: meta.artistName ?? undefined,
							artist_id: meta.artistId ?? undefined,
							cover_url: meta.coverUrl ?? undefined,
							duration: meta.duration ?? undefined,
							bilibili_bvid: meta.bvid,
							bilibili_cid: meta.cid?.toString(),
						},
						sort_key: meta.sortKey,
						operation_at: this.toMillis(row.operationAt),
					})
				}
			} else if (row.operation === 'remove_tracks') {
				const ids = (payload.removedTrackIds as number[]) || []
				if (ids.length === 0) rowValid = false
				for (const tid of ids) {
					const meta = metaMap.get(tid)
					if (!meta) {
						rowValid = false
						break
					}
					rowChanges.push({
						op: 'remove',
						track_unique_key: meta.uniqueKey,
						operation_at: this.toMillis(row.operationAt),
					})
				}
			} else if (row.operation === 'reorder_track') {
				const tid = payload.trackId as number
				const meta = metaMap.get(tid)
				if (!meta || !meta.sortKey) {
					rowValid = false
				} else {
					rowChanges.push({
						op: 'reorder',
						track_unique_key: meta.uniqueKey,
						sort_key: meta.sortKey,
						operation_at: this.toMillis(row.operationAt),
					})
				}
			}

			if (rowValid && rowChanges.length > 0) {
				changes.push(...rowChanges)
				validRowIds.add(row.id)
			} else {
				invalidRowIds.push(row.id)
			}
		}

		return { changes, validRowIds, invalidRowIds }
	}

	private async pushMetadataChanges(
		shareId: string,
		rows: QueueRow[],
	): Promise<void> {
		// 只取最后一条（LWW）
		const latest = rows[rows.length - 1]
		const payload = this.parsePayload(latest.payload) as {
			title?: string | null
			description?: string | null
			coverUrl?: string | null
		}
		const rowIds = rows.map((r) => r.id)
		await this.markRows(rowIds, 'syncing')

		try {
			const resp = await bbplayerApi.playlists[':id'].$patch({
				param: { id: shareId },
				json: {
					title: payload.title ?? undefined,
					description: payload.description ?? undefined,
					cover_url: payload.coverUrl ?? undefined,
				},
			})
			if (!resp.ok) {
				const body = await resp.json().catch(() => ({}))
				throw new Error(`API ${resp.status}` + (JSON.stringify(body) ?? ''))
			}

			await db
				.update(schema.playlistSyncQueue)
				.set({ status: 'done' })
				.where(inArray(schema.playlistSyncQueue.id, rowIds))
		} catch (error) {
			logger.error('pushMetadataChanges 失败', { error })
			await this.markRows(rowIds, 'failed')
		}
	}

	private async fetchTrackMetadata(
		playlistId: number,
		trackIds: number[],
	): Promise<Map<number, TrackMeta>> {
		if (trackIds.length === 0) return new Map()

		const metaRows = await db
			.select({
				trackId: schema.tracks.id,
				uniqueKey: schema.tracks.uniqueKey,
				title: schema.tracks.title,
				artistName: schema.artists.name,
				artistId: schema.artists.remoteId,
				coverUrl: schema.tracks.coverUrl,
				duration: schema.tracks.duration,
				bvid: schema.bilibiliMetadata.bvid,
				cid: schema.bilibiliMetadata.cid,
			})
			.from(schema.tracks)
			.leftJoin(schema.artists, eq(schema.tracks.artistId, schema.artists.id))
			.leftJoin(
				schema.bilibiliMetadata,
				eq(schema.tracks.id, schema.bilibiliMetadata.trackId),
			)
			.where(inArray(schema.tracks.id, trackIds))

		const sortKeyRows = await db
			.select({
				trackId: schema.playlistTracks.trackId,
				sortKey: schema.playlistTracks.sortKey,
			})
			.from(schema.playlistTracks)
			.where(
				and(
					eq(schema.playlistTracks.playlistId, playlistId),
					inArray(schema.playlistTracks.trackId, trackIds),
				),
			)

		const sortMap = new Map<number, string>()
		for (const row of sortKeyRows) {
			sortMap.set(row.trackId, row.sortKey)
		}

		const metaMap = new Map<number, TrackMeta>()
		for (const row of metaRows) {
			metaMap.set(row.trackId, {
				trackId: row.trackId,
				uniqueKey: row.uniqueKey,
				title: row.title,
				artistName: row.artistName,
				artistId: row.artistId,
				coverUrl: row.coverUrl,
				duration: row.duration,
				bvid: row.bvid,
				cid: row.cid,
				sortKey: sortMap.get(row.trackId),
			})
		}

		return metaMap
	}

	private parsePayload(payload: unknown): Record<string, unknown> {
		if (payload === null || payload === undefined) return {}
		if (typeof payload === 'string') {
			try {
				return JSON.parse(payload)
			} catch (e) {
				logger.error('parsePayload 失败', { payload, error: e })
				return {}
			}
		}
		if (typeof payload === 'object') return payload as Record<string, unknown>
		return {}
	}

	private toMillis(value: unknown): number {
		if (value instanceof Date) return value.getTime()
		if (typeof value === 'number') return value
		if (typeof value === 'string') {
			const num = Number(value)
			return Number.isNaN(num) ? Date.now() : num
		}
		return Date.now()
	}

	private async markRows(
		ids: number[],
		status: 'pending' | 'syncing' | 'done' | 'failed',
	): Promise<void> {
		if (ids.length === 0) return
		await db
			.update(schema.playlistSyncQueue)
			.set({ status })
			.where(inArray(schema.playlistSyncQueue.id, ids))
	}

	/** 永久性无效的记录（不可能成功），直接从队列中删除 */
	private async deleteRows(ids: number[]): Promise<void> {
		if (ids.length === 0) return
		await db
			.delete(schema.playlistSyncQueue)
			.where(inArray(schema.playlistSyncQueue.id, ids))
	}
}

export const playlistSyncWorker = new PlaylistSyncWorker()
