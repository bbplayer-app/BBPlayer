import { and, asc, eq, inArray } from 'drizzle-orm'

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
			logger.error('syncSinglePlaylist: 读取歌单失败', {
				playlistId,
				error: playlistRes.error,
			})
			return
		}

		const playlist = playlistRes.value
		if (!playlist?.shareId || !playlist.shareRole) {
			await this.markRows(
				queueRows.map((r) => r.id),
				'failed',
			)
			return
		}
		if (playlist.shareRole === 'subscriber') {
			await this.markRows(
				queueRows.map((r) => r.id),
				'failed',
			)
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
				await this.markRows(
					metadataOps.map((r) => r.id),
					'failed',
				)
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
		// 拆分三种 track 操作
		const addOps: QueueRow[] = []
		const removeOps: QueueRow[] = []
		const reorderOps: QueueRow[] = []
		for (const row of rows) {
			if (row.operation === 'add_tracks') addOps.push(row)
			else if (row.operation === 'remove_tracks') removeOps.push(row)
			else if (row.operation === 'reorder_track') reorderOps.push(row)
		}

		const trackIds = new Set<number>()
		for (const row of addOps) {
			const payload = this.parsePayload(row.payload) as { trackIds?: number[] }
			payload.trackIds?.forEach((id) => trackIds.add(id))
		}
		for (const row of removeOps) {
			const payload = this.parsePayload(row.payload) as {
				removedTrackIds?: number[]
			}
			payload.removedTrackIds?.forEach((id) => trackIds.add(id))
		}
		for (const row of reorderOps) {
			const payload = this.parsePayload(row.payload) as { trackId?: number }
			if (payload.trackId !== undefined) trackIds.add(payload.trackId)
		}

		if (trackIds.size === 0) {
			await this.markRows(
				rows.map((r) => r.id),
				'failed',
			)
			return
		}

		const metaMap = await this.fetchTrackMetadata(playlistId, [...trackIds])

		const invalidRowIds: number[] = []
		const validRowIds = new Set<number>()
		const changes: Array<
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
		> = []

		// add_tracks → upsert
		for (const row of addOps) {
			const payload = this.parsePayload(row.payload) as { trackIds?: number[] }
			if (!payload.trackIds || payload.trackIds.length === 0) {
				invalidRowIds.push(row.id)
				continue
			}

			const rowChanges: typeof changes = []
			let rowValid = true
			for (const tid of payload.trackIds) {
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
						bilibili_cid:
							meta.cid !== null && meta.cid !== undefined
								? String(meta.cid)
								: undefined,
					},
					sort_key: meta.sortKey,
					operation_at: this.toMillis(row.operationAt),
				})
			}

			if (!rowValid) {
				invalidRowIds.push(row.id)
				continue
			}

			changes.push(...rowChanges)
			validRowIds.add(row.id)
		}

		// remove_tracks
		for (const row of removeOps) {
			const payload = this.parsePayload(row.payload) as {
				removedTrackIds?: number[]
			}
			if (!payload.removedTrackIds || payload.removedTrackIds.length === 0) {
				invalidRowIds.push(row.id)
				continue
			}
			let rowValid = true
			const rowChanges: typeof changes = []
			for (const tid of payload.removedTrackIds) {
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
			if (!rowValid) {
				invalidRowIds.push(row.id)
				continue
			}
			changes.push(...rowChanges)
			validRowIds.add(row.id)
		}

		// reorder_track
		for (const row of reorderOps) {
			const payload = this.parsePayload(row.payload) as {
				trackId?: number
			}
			if (payload.trackId === undefined) {
				invalidRowIds.push(row.id)
				continue
			}
			const meta = metaMap.get(payload.trackId)
			if (!meta || !meta.sortKey) {
				invalidRowIds.push(row.id)
				continue
			}
			changes.push({
				op: 'reorder',
				track_unique_key: meta.uniqueKey,
				sort_key: meta.sortKey,
				operation_at: this.toMillis(row.operationAt),
			})
			validRowIds.add(row.id)
		}

		if (invalidRowIds.length > 0) {
			await this.markRows(invalidRowIds, 'failed')
		}

		if (changes.length === 0) return

		// operation_at 升序，确保与服务器 LWW 对齐
		changes.sort((a, b) => a.operation_at - b.operation_at)

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
			await this.markRows(
				rows.map((r) => r.id),
				'failed',
			)
		}
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
				.where(
					inArray(
						schema.playlistSyncQueue.id,
						rows.map((r) => r.id),
					),
				)
		} catch (error) {
			logger.error('pushMetadataChanges 失败', { error })
			await this.markRows(
				rows.map((r) => r.id),
				'failed',
			)
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
		if (typeof value === 'string') return Number(value)
		return Date.now()
	}

	private async markRows(
		ids: number[],
		status: 'done' | 'failed',
	): Promise<void> {
		if (ids.length === 0) return
		await db
			.update(schema.playlistSyncQueue)
			.set({ status })
			.where(inArray(schema.playlistSyncQueue.id, ids))
	}
}

export const playlistSyncWorker = new PlaylistSyncWorker()
