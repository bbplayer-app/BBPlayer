import * as Sentry from '@sentry/react-native'
import type { SQL } from 'drizzle-orm'
import { and, desc, eq, inArray, like, lt, or, sql } from 'drizzle-orm'
import { type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { generateKeyBetween } from 'fractional-indexing'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'

import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { ServiceError } from '@/lib/errors'
import {
	DatabaseError,
	createPlaylistNotFound,
	createTrackNotInPlaylist,
	createValidationError,
} from '@/lib/errors/service'
import type { Playlist, Track } from '@/types/core/media'
import type {
	CreatePlaylistPayload,
	ReorderLocalPlaylistTrackPayload,
	UpdatePlaylistPayload,
} from '@/types/services/playlist'

import type { TrackService } from './trackService'
import { trackService } from './trackService'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DBLike = ExpoSQLiteDatabase<typeof schema> | Tx
type PlaylistTrackRow = typeof schema.playlistTracks.$inferSelect & {
	track: typeof schema.tracks.$inferSelect & {
		artist: typeof schema.artists.$inferSelect | null
		bilibiliMetadata: typeof schema.bilibiliMetadata.$inferSelect | null
		localMetadata: typeof schema.localMetadata.$inferSelect | null
	}
}
type DynamicPlaylistTrackSqlRow = {
	sourcePosition: number
	trackId: number
	sourceSortKey: string
	sortKey: string
	createdAt: number
	trackUniqueKey: string
	trackTitle: string
	trackArtistId: number | null
	trackCoverUrl: string | null
	trackDuration: number
	trackCreatedAt: number
	trackSource: 'bilibili' | 'local'
	trackUpdatedAt: number
	artistId: number | null
	artistName: string | null
	artistAvatarUrl: string | null
	artistSignature: string | null
	artistSource: 'bilibili' | 'local' | null
	artistRemoteId: string | null
	artistCreatedAt: number | null
	artistUpdatedAt: number | null
	bilibiliTrackId: number | null
	bilibiliBvid: string | null
	bilibiliCid: number | null
	bilibiliIsMultiPage: number | boolean | null
	bilibiliMainTrackTitle: string | null
	bilibiliVideoIsValid: number | boolean | null
	localTrackId: number | null
	localPath: string | null
}
type DynamicPlaylistStats = {
	itemCount: number
	validTrackCount: number
	totalDuration: number
}

/**
 * 对于内部 tracks 的增删改操作只有 local playlist 才可以，注意方法名。
 */
export class PlaylistService {
	constructor(
		private readonly db: DBLike,
		private readonly trackService: TrackService,
	) {}

	/**
	 * 返回一个使用新数据库连接（例如事务）的新实例。
	 * @param conn - 新的数据库连接或事务。
	 * @returns 一个新的实例。
	 */
	withDB(conn: DBLike) {
		return new PlaylistService(conn, this.trackService.withDB(conn))
	}

	private parseDynamicCursor(cursor?: {
		lastSortKey: string
		createdAt: number
		lastId: number
	}) {
		if (!cursor) return undefined

		const separatorIndex = cursor.lastSortKey.indexOf('|')
		if (separatorIndex < 0) return undefined

		const sourcePosition = Number(cursor.lastSortKey.slice(0, separatorIndex))
		const sourceSortKey = cursor.lastSortKey.slice(separatorIndex + 1)
		if (!Number.isFinite(sourcePosition) || !sourceSortKey) return undefined

		return {
			sourcePosition,
			sourceSortKey,
			createdAt: cursor.createdAt,
			lastId: cursor.lastId,
		}
	}

	private mapDynamicPlaylistTrackRow(
		row: DynamicPlaylistTrackSqlRow,
	): PlaylistTrackRow {
		return {
			playlistId: 0,
			trackId: row.trackId,
			sortKey: row.sortKey,
			createdAt: new Date(row.createdAt),
			track: {
				id: row.trackId,
				uniqueKey: row.trackUniqueKey,
				title: row.trackTitle,
				artistId: row.trackArtistId,
				coverUrl: row.trackCoverUrl,
				duration: row.trackDuration,
				createdAt: new Date(row.trackCreatedAt),
				source: row.trackSource,
				updatedAt: new Date(row.trackUpdatedAt),
				artist:
					row.artistId === null || row.artistName === null
						? null
						: {
								id: row.artistId,
								name: row.artistName,
								avatarUrl: row.artistAvatarUrl,
								signature: row.artistSignature,
								source: row.artistSource ?? 'local',
								remoteId: row.artistRemoteId,
								createdAt: new Date(row.artistCreatedAt ?? 0),
								updatedAt: new Date(row.artistUpdatedAt ?? 0),
							},
				bilibiliMetadata:
					row.bilibiliTrackId === null || row.bilibiliBvid === null
						? null
						: {
								trackId: row.bilibiliTrackId,
								bvid: row.bilibiliBvid,
								cid: row.bilibiliCid,
								isMultiPage: Boolean(row.bilibiliIsMultiPage),
								mainTrackTitle: row.bilibiliMainTrackTitle,
								videoIsValid: Boolean(row.bilibiliVideoIsValid),
							},
				localMetadata:
					row.localTrackId === null || row.localPath === null
						? null
						: {
								trackId: row.localTrackId,
								localPath: row.localPath,
							},
			},
		}
	}

	private dynamicPlaylistRowsCte(playlistId: number) {
		return sql`
			WITH ranked_tracks AS (
				SELECT
					pt.track_id,
					dps.position AS source_position,
					pt.sort_key AS source_sort_key,
					(dps.position || '|' || pt.sort_key) AS sort_key,
					pt.created_at,
					ROW_NUMBER() OVER (
						PARTITION BY pt.track_id
						ORDER BY dps.position ASC, pt.sort_key DESC, pt.created_at DESC, pt.track_id DESC
					) AS row_number
				FROM ${schema.dynamicPlaylistSources} AS dps
				JOIN ${schema.playlistTracks} AS pt
					ON pt.playlist_id = dps.source_playlist_id
				WHERE dps.playlist_id = ${playlistId}
			),
			dynamic_tracks AS (
				SELECT *
				FROM ranked_tracks
				WHERE row_number = 1
			)
		`
	}

	private async queryDynamicPlaylistTrackRows({
		playlistId,
		query,
		limit,
		cursor,
	}: {
		playlistId: number
		query?: string
		limit?: number
		cursor?: {
			lastSortKey: string
			createdAt: number
			lastId: number
		}
	}): Promise<PlaylistTrackRow[]> {
		const trimmed = query?.trim().toLowerCase()
		const likeQuery = trimmed ? `%${trimmed}%` : undefined
		const parsedCursor = this.parseDynamicCursor(cursor)
		const rows = this.db.all<DynamicPlaylistTrackSqlRow>(sql`
			${this.dynamicPlaylistRowsCte(playlistId)}
			SELECT
				dt.source_position AS sourcePosition,
				dt.track_id AS trackId,
				dt.source_sort_key AS sourceSortKey,
				dt.sort_key AS sortKey,
				dt.created_at AS createdAt,
				t.unique_key AS trackUniqueKey,
				t.title AS trackTitle,
				t.artist_id AS trackArtistId,
				t.cover_url AS trackCoverUrl,
				t.duration AS trackDuration,
				t.created_at AS trackCreatedAt,
				t.source AS trackSource,
				t.updated_at AS trackUpdatedAt,
				a.id AS artistId,
				a.name AS artistName,
				a.avatar_url AS artistAvatarUrl,
				a.signature AS artistSignature,
				a.source AS artistSource,
				a.remote_id AS artistRemoteId,
				a.created_at AS artistCreatedAt,
				a.updated_at AS artistUpdatedAt,
				bm.track_id AS bilibiliTrackId,
				bm.bvid AS bilibiliBvid,
				bm.cid AS bilibiliCid,
				bm.is_multi_page AS bilibiliIsMultiPage,
				bm.main_track_title AS bilibiliMainTrackTitle,
				bm.video_is_valid AS bilibiliVideoIsValid,
				lm.track_id AS localTrackId,
				lm.local_path AS localPath
			FROM dynamic_tracks AS dt
			JOIN ${schema.tracks} AS t
				ON t.id = dt.track_id
			LEFT JOIN ${schema.artists} AS a
				ON a.id = t.artist_id
			LEFT JOIN ${schema.bilibiliMetadata} AS bm
				ON bm.track_id = t.id
			LEFT JOIN ${schema.localMetadata} AS lm
				ON lm.track_id = t.id
			WHERE
				${likeQuery === undefined ? sql`1 = 1` : sql`lower(t.title) LIKE ${likeQuery}`}
				AND ${
					parsedCursor === undefined
						? sql`1 = 1`
						: sql`(
								dt.source_position > ${parsedCursor.sourcePosition}
								OR (
									dt.source_position = ${parsedCursor.sourcePosition}
									AND (
										dt.source_sort_key < ${parsedCursor.sourceSortKey}
										OR (
											dt.source_sort_key = ${parsedCursor.sourceSortKey}
											AND dt.created_at < ${parsedCursor.createdAt}
										)
										OR (
											dt.source_sort_key = ${parsedCursor.sourceSortKey}
											AND dt.created_at = ${parsedCursor.createdAt}
											AND dt.track_id < ${parsedCursor.lastId}
										)
									)
								)
							)`
				}
			ORDER BY
				dt.source_position ASC,
				dt.source_sort_key DESC,
				dt.created_at DESC,
				dt.track_id DESC
			${limit === undefined ? sql`` : sql`LIMIT ${limit}`}
		`)

		return rows.map((row) => this.mapDynamicPlaylistTrackRow(row))
	}

	private async getDynamicPlaylistStats(
		playlistId: number,
	): Promise<DynamicPlaylistStats> {
		const row = this.db.get<DynamicPlaylistStats>(sql`
			${this.dynamicPlaylistRowsCte(playlistId)}
			SELECT
				COUNT(dt.track_id) AS itemCount,
				COUNT(
					CASE
						WHEN bm.video_is_valid IS NOT false THEN dt.track_id
					END
				) AS validTrackCount,
				COALESCE(SUM(
					CASE
						WHEN bm.video_is_valid IS NOT false THEN t.duration
						ELSE 0
					END
				), 0) AS totalDuration
			FROM dynamic_tracks AS dt
			JOIN ${schema.tracks} AS t
				ON t.id = dt.track_id
			LEFT JOIN ${schema.bilibiliMetadata} AS bm
				ON bm.track_id = t.id
		`)

		return {
			itemCount: Number(row?.itemCount ?? 0),
			validTrackCount: Number(row?.validTrackCount ?? 0),
			totalDuration: Number(row?.totalDuration ?? 0),
		}
	}

	private async getDynamicPlaylistCounts(playlistIds: number[]) {
		const uniqueIds = Array.from(new Set(playlistIds))
		if (uniqueIds.length === 0) return new Map<number, number>()

		const rows = this.db.all<{ playlistId: number; itemCount: number }>(
			sql`
				WITH ranked_tracks AS (
					SELECT
						dps.playlist_id,
						pt.track_id,
						ROW_NUMBER() OVER (
							PARTITION BY dps.playlist_id, pt.track_id
							ORDER BY dps.position ASC, pt.sort_key DESC, pt.created_at DESC, pt.track_id DESC
						) AS row_number
					FROM ${schema.dynamicPlaylistSources} AS dps
					JOIN ${schema.playlistTracks} AS pt
						ON pt.playlist_id = dps.source_playlist_id
					WHERE dps.playlist_id IN (${sql.join(
						uniqueIds.map((id) => sql`${id}`),
						sql`, `,
					)})
				)
				SELECT playlist_id AS playlistId, COUNT(track_id) AS itemCount
				FROM ranked_tracks
				WHERE row_number = 1
				GROUP BY playlist_id
			`,
		)

		return new Map(
			uniqueIds.map((id) => [
				id,
				Number(rows.find((row) => row.playlistId === id)?.itemCount ?? 0),
			]),
		)
	}

	/**
	 * 创建一个新的播放列表。
	 * @param payload - 创建播放列表所需的数据。
	 * @returns ResultAsync 包含成功创建的 Playlist 或一个错误。
	 */
	public createPlaylist(
		payload: CreatePlaylistPayload,
	): ResultAsync<
		typeof schema.playlists.$inferSelect,
		DatabaseError | ServiceError
	> {
		return ResultAsync.fromPromise(
			(async () => {
				const insertValues: typeof schema.playlists.$inferInsert = {
					title: payload.title,
					authorId: payload.authorId ?? null,
					description: payload.description ?? null,
					coverUrl: payload.coverUrl ?? null,
					type: payload.type,
					remoteSyncId: payload.remoteSyncId ?? null,
					shareId: payload.shareId ?? null,
					shareRole: payload.shareRole ?? null,
					lastShareSyncAt:
						payload.lastShareSyncAt === undefined
							? undefined
							: payload.lastShareSyncAt === null
								? null
								: new Date(payload.lastShareSyncAt),
				}

				const [result] = await Sentry.startSpan(
					{ name: 'db:insert:playlist', op: 'db' },
					() =>
						this.db.insert(schema.playlists).values(insertValues).returning(),
				)
				return result
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError('创建播放列表失败', { cause: e }),
		).andThen((result) => {
			return okAsync(result)
		})
	}

	/**
	 * 更新一个播放列表元数据。
	 * @param playlistId - 要更新的播放列表的 ID。
	 * @param payload - 更新所需的数据。
	 * @returns ResultAsync 包含更新后的 Playlist 或一个错误。
	 */
	public updatePlaylistMetadata(
		playlistId: number,
		payload: UpdatePlaylistPayload,
	): ResultAsync<
		typeof schema.playlists.$inferSelect,
		DatabaseError | ServiceError
	> {
		return ResultAsync.fromPromise(
			(async () => {
				// 验证播放列表是否存在
				const existing = await Sentry.startSpan(
					{ name: 'db:query:playlist:exist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: and(
								eq(schema.playlists.id, playlistId),
								// eq(schema.playlists.type, 'local'),
							),
						}),
				)
				if (!existing) {
					throw createPlaylistNotFound(playlistId)
				}

				const [updated] = await Sentry.startSpan(
					{ name: 'db:update:playlist', op: 'db' },
					() =>
						this.db
							.update(schema.playlists)
							.set({
								title: payload.title ?? undefined,
								description: payload.description,
								coverUrl: payload.coverUrl,
								shareId: payload.shareId,
								shareRole: payload.shareRole,
								lastShareSyncAt: payload.lastShareSyncAt
									? new Date(payload.lastShareSyncAt)
									: payload.lastShareSyncAt === null
										? null
										: undefined,
							})
							.where(eq(schema.playlists.id, playlistId))
							.returning(),
				)

				return updated
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError(`更新播放列表 ${playlistId} 失败`, {
							cause: e,
						}),
		)
	}

	/**
	 * 删除一个播放列表。
	 * @param playlistId - 要删除的播放列表的 ID。
	 * @returns ResultAsync 包含删除的 ID 或一个错误。
	 */
	public deletePlaylist(
		playlistId: number,
	): ResultAsync<{ deletedId: number }, DatabaseError | ServiceError> {
		return ResultAsync.fromPromise(
			(async () => {
				// 验证播放列表是否存在
				const existing = await Sentry.startSpan(
					{ name: 'db:query:playlist:exist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: and(eq(schema.playlists.id, playlistId)),
							columns: { id: true },
						}),
				)
				if (!existing) {
					throw createPlaylistNotFound(playlistId)
				}

				const [deleted] = await Sentry.startSpan(
					{ name: 'db:delete:playlist', op: 'db' },
					() =>
						this.db
							.delete(schema.playlists)
							.where(eq(schema.playlists.id, playlistId))
							.returning({ deletedId: schema.playlists.id }),
				)

				return deleted
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError(`删除播放列表 ${playlistId} 失败`, {
							cause: e,
						}),
		)
	}

	/**
	 * 批量添加 tracks 到本地播放列表。
	 * 新 track 总是追加到末尾（sort_key 最大值）。
	 */
	public addManyTracksToLocalPlaylist(
		playlistId: number,
		trackIds: number[],
	): ResultAsync<
		(typeof schema.playlistTracks.$inferSelect)[],
		DatabaseError | ServiceError
	> {
		if (trackIds.length === 0) {
			return okAsync([])
		}

		return ResultAsync.fromPromise(
			(async () => {
				// 验证播放列表是否存在且为 local
				const playlist = await Sentry.startSpan(
					{ name: 'db:query:playlist:exist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: and(
								eq(schema.playlists.id, playlistId),
								eq(schema.playlists.type, 'local'),
							),
							columns: { id: true, itemCount: true },
						}),
				)
				if (!playlist) {
					throw createPlaylistNotFound(playlistId)
				}

				// 获取当前最大 sort_key（DESC 排序下，最大值对应最新加入的歌曲）
				const maxKeyResult = await Sentry.startSpan(
					{ name: 'db:query:max_sort_key', op: 'db' },
					() =>
						this.db
							.select({
								maxKey: sql<
									string | null
								>`MAX(${schema.playlistTracks.sortKey})`,
							})
							.from(schema.playlistTracks)
							.where(eq(schema.playlistTracks.playlistId, playlistId)),
				)
				let prevKey: string | null = maxKeyResult[0].maxKey ?? null

				// 构造批量插入的行，每条用 generateKeyBetween(prevKey, null) 追加到末端
				const values = trackIds.map((tid) => {
					const sortKey = generateKeyBetween(prevKey, null)
					prevKey = sortKey
					return {
						playlistId,
						trackId: tid,
						sortKey,
					}
				})

				// 批量插入（忽略已存在的）
				const inserted = await Sentry.startSpan(
					{ name: 'db:insert:playlistTracks', op: 'db' },
					() =>
						this.db
							.insert(schema.playlistTracks)
							.values(values)
							.onConflictDoNothing({
								target: [
									schema.playlistTracks.playlistId,
									schema.playlistTracks.trackId,
								],
							})
							.returning(),
				)

				// 更新播放列表的 itemCount（+ 成功插入的数量）
				if (inserted.length > 0) {
					await Sentry.startSpan(
						{ name: 'db:update:playlist:itemCount', op: 'db' },
						() =>
							this.db
								.update(schema.playlists)
								.set({
									itemCount: sql`${schema.playlists.itemCount} + ${inserted.length}`,
								})
								.where(eq(schema.playlists.id, playlistId)),
					)
				}

				return inserted
			})(),
			(e) => new DatabaseError('批量添加歌曲到播放列表失败', { cause: e }),
		)
	}

	/**
	 * 从本地播放列表批量移除歌曲
	 * @param playlistId - 目标播放列表的 ID。
	 * @param trackIdList - 要移除的歌曲的 ID 们
	 * @returns [removedTrackIds, missingTrackIds] 分别为被移除的 ID 和不在播放列表中的 ID
	 */
	public batchRemoveTracksFromLocalPlaylist(
		playlistId: number,
		trackIdList: number[],
	): ResultAsync<
		{ removedTrackIds: number[]; missingTrackIds: number[] },
		DatabaseError | ServiceError
	> {
		return ResultAsync.fromPromise(
			(async () => {
				if (trackIdList.length === 0) {
					return { removedTrackIds: [], missingTrackIds: [] }
				}

				// 验证播放列表是否存在且为 'local'
				const playlist = await Sentry.startSpan(
					{ name: 'db:query:playlist:exist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: and(
								eq(schema.playlists.id, playlistId),
								eq(schema.playlists.type, 'local'),
							),
							columns: { id: true },
						}),
				)
				if (!playlist) {
					throw createPlaylistNotFound(playlistId)
				}

				// 2) 批量删除关联记录，并拿到实际删除的 trackId
				const deletedLinks = await Sentry.startSpan(
					{ name: 'db:delete:playlistTracks', op: 'db' },
					() =>
						this.db
							.delete(schema.playlistTracks)
							.where(
								and(
									eq(schema.playlistTracks.playlistId, playlistId),
									inArray(schema.playlistTracks.trackId, trackIdList),
								),
							)
							.returning({ trackId: schema.playlistTracks.trackId }),
				)

				const removedTrackIds = deletedLinks.map((x) => x.trackId)
				const removedCount = removedTrackIds.length

				if (removedCount === 0) {
					throw createTrackNotInPlaylist(trackIdList[0], playlistId)
				}

				// 更新 itemCount（不小于 0）
				await Sentry.startSpan(
					{ name: 'db:update:playlist:itemCount', op: 'db' },
					() =>
						this.db
							.update(schema.playlists)
							.set({
								itemCount: sql`MAX(0, ${schema.playlists.itemCount} - ${removedCount})`,
							})
							.where(eq(schema.playlists.id, playlistId)),
				)

				// 计算 missing 列表（传入但未删除，说明本就不在该列表）
				const removedSet = new Set(removedTrackIds)
				const missingTrackIds = trackIdList.filter((id) => !removedSet.has(id))

				return { removedTrackIds, missingTrackIds }
			})(),
			(e) => {
				if (e instanceof ServiceError) return e
				return new DatabaseError('从播放列表批量移除歌曲的事务失败', {
					cause: e,
				})
			},
		)
	}

	/**
	 * 在本地播放列表中移动单个歌曲的位置（fractional indexing）。
	 * 只需知道目标槽位两侧的 sort_key 即可，单行写入，无需移动其他行。
	 *
	 * @param playlistId - 目标播放列表的 ID。
	 * @param payload - 包含 trackId 和目标位置前后两项的 sortKey。
	 * @returns ResultAsync
	 */
	public reorderSingleLocalPlaylistTrack(
		playlistId: number,
		payload: ReorderLocalPlaylistTrackPayload,
	): ResultAsync<true, DatabaseError | ServiceError> {
		const { trackId, prevSortKey, nextSortKey } = payload

		return ResultAsync.fromPromise(
			(async () => {
				const playlist = await Sentry.startSpan(
					{ name: 'db:query:playlist:exist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: and(
								eq(schema.playlists.id, playlistId),
								eq(schema.playlists.type, 'local'),
							),
							columns: { id: true },
						}),
				)
				if (!playlist) {
					throw createPlaylistNotFound(playlistId)
				}

				// 前置校验：prevSortKey 必须小于 nextSortKey
				if (
					prevSortKey !== null &&
					nextSortKey !== null &&
					prevSortKey >= nextSortKey
				) {
					throw new ServiceError(
						`Invalid sort keys: prevSortKey must be less than nextSortKey (got "${prevSortKey}" >= "${nextSortKey}")`,
					)
				}

				// 生成新的 sort_key（在 prevSortKey 和 nextSortKey 之间）
				const newSortKey = generateKeyBetween(prevSortKey, nextSortKey)

				await Sentry.startSpan(
					{ name: 'db:update:playlistTrack:sortKey', op: 'db' },
					() =>
						this.db
							.update(schema.playlistTracks)
							.set({ sortKey: newSortKey })
							.where(
								and(
									eq(schema.playlistTracks.playlistId, playlistId),
									eq(schema.playlistTracks.trackId, trackId),
								),
							),
				)

				return true as const
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError('重排序播放列表歌曲失败', {
							cause: e,
						}),
		)
	}

	/**
	 * 获取播放列表中的所有歌曲
	 * @param playlistId - 目标播放列表的 ID。
	 * @returns ResultAsync
	 */
	public getPlaylistTracks(
		playlistId: number,
	): ResultAsync<Track[], DatabaseError | ServiceError> {
		return ResultAsync.fromPromise(
			(async () => {
				const type = await Sentry.startSpan(
					{ name: 'db:query:playlist:type', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							columns: { type: true },
							where: eq(schema.playlists.id, playlistId),
						}),
				)
				if (!type) throw createPlaylistNotFound(playlistId)
				if (type.type === 'dynamic') {
					return this.queryDynamicPlaylistTrackRows({ playlistId })
				}
				// 所有播放列表类型统一使用 DESC：位置越靠前的曲目 sort_key 越大
				const orderBy = desc(schema.playlistTracks.sortKey)

				return Sentry.startSpan(
					{ name: 'db:query:playlistTracks', op: 'db' },
					() =>
						this.db.query.playlistTracks.findMany({
							where: eq(schema.playlistTracks.playlistId, playlistId),
							orderBy: orderBy,
							with: {
								track: {
									with: {
										artist: true,
										bilibiliMetadata: true,
										localMetadata: true,
									},
								},
							},
						}),
				)
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError('获取播放列表歌曲的事务失败', {
							cause: e,
						}),
		).andThen((data) => {
			const newTracks = []
			for (const track of data) {
				const t = this.trackService.formatTrack(track.track)
				if (!t)
					return errAsync(
						new ServiceError(
							`在格式化歌曲：${track.track.id} 时出错，可能是原数据不存在或 source & metadata 不匹配`,
						),
					)
				newTracks.push(t)
			}
			return okAsync(newTracks)
		})
	}

	/**
	 * 获取所有 playlists
	 */
	public getAllPlaylists(): ResultAsync<
		(typeof schema.playlists.$inferSelect & {
			author: typeof schema.artists.$inferSelect | null
		})[],
		DatabaseError
	> {
		return ResultAsync.fromPromise(
			(async () => {
				const playlists = await Sentry.startSpan(
					{ name: 'db:query:playlists', op: 'db' },
					() =>
						this.db.query.playlists.findMany({
							orderBy: desc(schema.playlists.updatedAt),
							with: {
								author: true,
							},
						}),
				)

				const countMap = await this.getDynamicPlaylistCounts(
					playlists
						.filter((playlist) => playlist.type === 'dynamic')
						.map((playlist) => playlist.id),
				)

				return playlists.map((playlist) => {
					if (playlist.type !== 'dynamic') return playlist
					return {
						...playlist,
						itemCount: countMap.get(playlist.id) ?? 0,
					}
				})
			})(),
			(e) => new DatabaseError('获取所有 playlists 失败', { cause: e }),
		).andThen((playlists) => {
			return okAsync(playlists)
		})
	}

	/**
	 * 获取指定 playlist 的元数据
	 * @param playlistId
	 */
	public getPlaylistMetadata(playlistId: number): ResultAsync<
		| (typeof schema.playlists.$inferSelect & {
				author: typeof schema.artists.$inferSelect | null
		  } & {
				validTrackCount: number
				totalDuration: number
		  })
		| undefined,
		DatabaseError
	> {
		return ResultAsync.fromPromise(
			(async () => {
				const playlist = await Sentry.startSpan(
					{ name: 'db:query:playlist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: eq(schema.playlists.id, playlistId),
							with: {
								author: true,
							},
						}),
				)

				if (!playlist || playlist.type !== 'dynamic') {
					return Sentry.startSpan({ name: 'db:query:playlist', op: 'db' }, () =>
						this.db.query.playlists.findFirst({
							where: eq(schema.playlists.id, playlistId),
							with: {
								author: true,
							},
							extras: {
								validTrackCount: sql<number>`(
            SELECT COUNT(pt.track_id)
            FROM ${schema.playlistTracks} AS pt
            LEFT JOIN ${schema.bilibiliMetadata} AS bm
              ON pt.track_id = bm.track_id
            WHERE pt.playlist_id = ${playlistId}
              AND (bm.video_is_valid IS NOT false)
          )`.as('valid_track_count'),
								totalDuration: sql<number>`(
            SELECT COALESCE(SUM(t.duration), 0)
            FROM ${schema.playlistTracks} AS pt
            JOIN ${schema.tracks} AS t
              ON pt.track_id = t.id
            LEFT JOIN ${schema.bilibiliMetadata} AS bm
              ON pt.track_id = bm.track_id
            WHERE pt.playlist_id = ${playlistId}
              AND (bm.video_is_valid IS NOT false)
						)`.as('total_duration'),
							},
						}),
					)
				}

				const stats = await this.getDynamicPlaylistStats(playlistId)

				return {
					...playlist,
					itemCount: stats.itemCount,
					validTrackCount: stats.validTrackCount,
					totalDuration: stats.totalDuration,
				}
			})(),
			(e) => new DatabaseError('获取 playlist 元数据失败', { cause: e }),
		)
	}

	/**
	 * 根据 remoteSyncId 和 type 查找或创建一个本地同步的远程播放列表。
	 * @param payload - 创建播放列表所需的数据。
	 * @returns ResultAsync 包含找到的或新创建的 Playlist，或一个 DatabaseError。
	 */
	public findOrCreateRemotePlaylist(
		payload: CreatePlaylistPayload,
	): ResultAsync<
		typeof schema.playlists.$inferSelect,
		DatabaseError | ServiceError
	> {
		const { remoteSyncId, type } = payload
		if (!remoteSyncId || type === 'local' || type === 'dynamic') {
			return errAsync(
				createValidationError(
					'无效的 remoteSyncId 或 type，调用 findOrCreateRemotePlaylist 时必须提供 remoteSyncId 和非 local 的 type',
				),
			)
		}
		return ResultAsync.fromPromise(
			(async () => {
				const existingPlaylist = await Sentry.startSpan(
					{ name: 'db:query:playlist', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							where: and(
								eq(schema.playlists.remoteSyncId, remoteSyncId),
								eq(schema.playlists.type, type),
							),
						}),
				)

				if (existingPlaylist) {
					return existingPlaylist
				}

				const [newPlaylist] = await Sentry.startSpan(
					{ name: 'db:insert:playlist', op: 'db' },
					() =>
						this.db
							.insert(schema.playlists)
							.values({
								title: payload.title,
								authorId: payload.authorId,
								description: payload.description,
								coverUrl: payload.coverUrl,
								type: payload.type,
								remoteSyncId: payload.remoteSyncId,
							})
							.returning(),
				)

				return newPlaylist
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError('查找或创建播放列表的事务失败', {
							cause: e,
						}),
		)
	}

	/**
	 * 使用一个 track ID 数组**完全替换**一个播放列表的内容。并会更新播放列表的 itemCount 和 lastSyncedAt。
	 * @param playlistId 要设置的播放列表 ID。
	 * @param trackIds 有序的歌曲 ID 数组。
	 * @returns ResultAsync
	 */
	public replacePlaylistAllTracks(
		playlistId: number,
		trackIds: number[],
	): ResultAsync<true, DatabaseError> {
		return ResultAsync.fromPromise(
			(async () => {
				await Sentry.startSpan(
					{ name: 'db:delete:playlistTracks', op: 'db' },
					() =>
						this.db
							.delete(schema.playlistTracks)
							.where(eq(schema.playlistTracks.playlistId, playlistId)),
				)

				if (trackIds.length > 0) {
					// 倒序生成 sort_key：trackIds[0]（排列首位）获得最大的 sort_key
					// 与 local playlist 约定一致：位置越靠前 sort_key 越大，查询时统一使用 DESC
					let prevKey: string | null = null
					const sortKeys: string[] = new Array(trackIds.length)
					for (let i = trackIds.length - 1; i >= 0; i--) {
						sortKeys[i] = generateKeyBetween(prevKey, null)
						prevKey = sortKeys[i]!
					}
					const newPlaylistTracks = trackIds.map((id, i) => ({
						playlistId: playlistId,
						trackId: id,
						sortKey: sortKeys[i],
					}))
					await Sentry.startSpan(
						{ name: 'db:insert:playlistTracks', op: 'db' },
						() =>
							this.db.insert(schema.playlistTracks).values(newPlaylistTracks),
					)
				}

				await Sentry.startSpan({ name: 'db:update:playlist', op: 'db' }, () =>
					this.db
						.update(schema.playlists)
						.set({
							itemCount: trackIds.length,
							lastSyncedAt: new Date(),
						})
						.where(eq(schema.playlists.id, playlistId)),
				)

				return true as const
			})(),
			(e) =>
				new DatabaseError(`设置播放列表歌曲失败 (ID: ${playlistId})`, {
					cause: e,
				}),
		)
	}

	/**
	 * 基于 type & remoteId 查询一个播放列表
	 * @param type
	 * @param remoteId
	 */
	public findPlaylistByTypeAndRemoteId(
		type: Playlist['type'],
		remoteId: number,
	): ResultAsync<
		| (typeof schema.playlists.$inferSelect & {
				trackLinks: (typeof schema.playlistTracks.$inferSelect)[]
		  })
		| undefined,
		DatabaseError
	> {
		return ResultAsync.fromPromise(
			Sentry.startSpan({ name: 'db:query:playlist', op: 'db' }, () =>
				this.db.query.playlists.findFirst({
					where: and(
						eq(schema.playlists.type, type),
						eq(schema.playlists.remoteSyncId, remoteId),
					),
					with: {
						trackLinks: true,
					},
				}),
			),
			(e) => new DatabaseError('查询播放列表失败', { cause: e }),
		)
	}

	/**
	 * 根据 ID 获取播放列表
	 * @param playlistId
	 */
	public getPlaylistById(playlistId: number) {
		return ResultAsync.fromPromise(
			Sentry.startSpan({ name: 'db:query:playlist', op: 'db' }, () =>
				this.db.query.playlists.findFirst({
					where: eq(schema.playlists.id, playlistId),
					with: {
						author: true,
						trackLinks: true,
					},
				}),
			),
			(e) => new DatabaseError('查询播放列表失败', { cause: e }),
		)
	}

	/**
	 * 通过 uniqueKey 获取包含指定歌曲的所有本地播放列表
	 * @param uniqueKey:  track uniqueKey
	 */
	public getLocalPlaylistsContainingTrackByUniqueKey(
		uniqueKey: string,
	): ResultAsync<(typeof schema.playlists.$inferSelect)[], DatabaseError> {
		return this.trackService
			.findTrackIdsByUniqueKeys([uniqueKey])
			.andThen((trackIds) => {
				if (!trackIds.has(uniqueKey)) return okAsync([])
				return ResultAsync.fromPromise(
					Sentry.startSpan({ name: 'db:query:playlists', op: 'db' }, () =>
						this.db.query.playlists.findMany({
							where: and(
								eq(schema.playlists.type, 'local'),
								inArray(
									schema.playlists.id,
									this.db
										.select({
											playlistId: schema.playlistTracks.playlistId,
										})
										.from(schema.playlistTracks)
										.where(
											eq(
												schema.playlistTracks.trackId,
												trackIds.get(uniqueKey)!,
											),
										),
								),
							),
						}),
					),
					(e) =>
						new DatabaseError('获取包含该歌曲的本地播放列表失败', {
							cause: e,
						}),
				).andThen((playlists) => {
					return okAsync(playlists)
				})
			})
	}

	/**
	 * 获取包含指定歌曲的所有本地播放列表
	 * @param trackId:  track id（number）
	 */
	public getLocalPlaylistsContainingTrackById(
		trackId: number,
	): ResultAsync<(typeof schema.playlists.$inferSelect)[], DatabaseError> {
		return ResultAsync.fromPromise(
			Sentry.startSpan({ name: 'db:query:playlists', op: 'db' }, () =>
				this.db.query.playlists.findMany({
					where: and(
						eq(schema.playlists.type, 'local'),
						inArray(
							schema.playlists.id,
							this.db
								.select({
									playlistId: schema.playlistTracks.playlistId,
								})
								.from(schema.playlistTracks)
								.where(eq(schema.playlistTracks.trackId, trackId)),
						),
					),
				}),
			),
			(e) =>
				new DatabaseError('获取包含该歌曲的本地播放列表失败', {
					cause: e,
				}),
		).andThen((playlists) => {
			return okAsync(playlists)
		})
	}

	/**
	 * 搜索播放列表
	 * @param query - 搜索关键词
	 */
	public searchPlaylists(query: string): ResultAsync<
		(typeof schema.playlists.$inferSelect & {
			author: typeof schema.artists.$inferSelect | null
		})[],
		DatabaseError
	> {
		const trimmed = query.trim()
		if (!trimmed) {
			return okAsync([])
		}
		return ResultAsync.fromPromise(
			(async () => {
				const playlists = await Sentry.startSpan(
					{ name: 'db:query:searchPlaylists', op: 'db' },
					() =>
						this.db.query.playlists.findMany({
							where: like(schema.playlists.title, `%${trimmed}%`),
							orderBy: desc(schema.playlists.updatedAt),
							with: {
								author: true,
							},
						}),
				)

				const countMap = await this.getDynamicPlaylistCounts(
					playlists
						.filter((playlist) => playlist.type === 'dynamic')
						.map((playlist) => playlist.id),
				)

				return playlists.map((playlist) => {
					if (playlist.type !== 'dynamic') return playlist
					return {
						...playlist,
						itemCount: countMap.get(playlist.id) ?? 0,
					}
				})
			})(),
			(e) => new DatabaseError('搜索播放列表失败', { cause: e }),
		)
	}

	/**
	 * 在某个 playlist 中依据名字搜索歌曲
	 * @param playlistId
	 * @param query
	 */
	public searchTrackInPlaylist(
		playlistId: number,
		query: string,
	): ResultAsync<Track[], DatabaseError | ServiceError> {
		const q = `%${query.trim().toLowerCase()}%`

		return ResultAsync.fromPromise(
			(async () => {
				const playlist = await Sentry.startSpan(
					{ name: 'db:query:playlist:type', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							columns: { type: true },
							where: eq(schema.playlists.id, playlistId),
						}),
				)
				if (!playlist) throw createPlaylistNotFound(playlistId)
				if (playlist.type === 'dynamic') {
					const rows = await this.queryDynamicPlaylistTrackRows({
						playlistId,
						query,
					})
					const tracks: Track[] = []
					for (const row of rows) {
						const track = this.trackService.formatTrack(row.track)
						if (!track) {
							throw new ServiceError(
								`在格式化歌曲：${row.track.id} 时出错，可能是原数据不存在或 source & metadata 不匹配`,
							)
						}
						tracks.push(track)
					}
					return tracks
				}

				const trackIdSubq = db
					.select({ id: schema.tracks.id })
					.from(schema.tracks)
					.leftJoin(
						schema.artists,
						eq(schema.tracks.artistId, schema.artists.id),
					)
					.where(like(sql`lower(${schema.tracks.title})`, q))

				const rows = await Sentry.startSpan(
					{ name: 'db:query:playlistTracks', op: 'db' },
					() =>
						db.query.playlistTracks.findMany({
							where: and(
								eq(schema.playlistTracks.playlistId, playlistId),
								inArray(schema.playlistTracks.trackId, trackIdSubq),
							),
							with: {
								track: {
									with: {
										artist: true,
										bilibiliMetadata: true,
										localMetadata: true,
									},
								},
							},
							orderBy: desc(schema.playlistTracks.sortKey),
						}),
				)

				const newTracks = []
				for (const row of rows) {
					const t = this.trackService.formatTrack(row.track)
					if (!t)
						throw new ServiceError(
							`在格式化歌曲：${row.track.id} 时出错，可能是原数据不存在或 source & metadata 不匹配`,
						)
					newTracks.push(t)
				}
				return newTracks
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError('搜索歌曲失败', { cause: e }),
		)
	}

	/**
	 * 游标分页的获取播放列表中歌曲
	 *
	 * @param options - 分页选项
	 * @param options.playlistId - 目标播放列表的 ID。
	 * @param options.initialLimit - 如果是第一页，使用的数量限制（如无则为 limit）
	 * @param options.limit - 每次获取的数量
	 * @param options.cursor - 上一页最后一条记录的游标。
	 * 如果是第一页，则为 undefined。
	 * @returns ResultAsync 包含歌曲列表和下一个游标
	 */
	public getPlaylistTracksPaginated(options: {
		playlistId: number
		initialLimit?: number
		limit: number
		cursor:
			| {
					lastSortKey: string
					createdAt: number
					lastId: number
			  }
			| undefined
	}): ResultAsync<
		{
			tracks: Track[]
			sortKeys: string[]
			nextCursor?: {
				lastSortKey: string
				createdAt: number
				lastId: number
			}
			nextPageFirstSortKey?: string
		},
		DatabaseError | ServiceError
	> {
		const { limit, cursor, playlistId, initialLimit } = options

		const effectiveLimit = cursor ? limit : (initialLimit ?? limit)

		return ResultAsync.fromPromise(
			(async () => {
				const playlist = await Sentry.startSpan(
					{ name: 'db:query:playlist:type', op: 'db' },
					() =>
						this.db.query.playlists.findFirst({
							columns: { type: true },
							where: eq(schema.playlists.id, playlistId),
						}),
				)
				if (!playlist) throw createPlaylistNotFound(playlistId)
				if (playlist.type === 'dynamic') {
					return this.queryDynamicPlaylistTrackRows({
						playlistId,
						limit: effectiveLimit + 1,
						cursor,
					})
				}

				// 所有播放列表类型统一使用 DESC：位置越靠前的曲目 sort_key 越大
				const sortDirection = desc
				const operator = lt

				const orderBy = [
					sortDirection(schema.playlistTracks.sortKey),
					sortDirection(schema.playlistTracks.createdAt),
					sortDirection(schema.playlistTracks.trackId),
				]

				const whereClauses: (SQL | undefined)[] = [
					eq(schema.playlistTracks.playlistId, playlistId),
				]

				if (cursor) {
					const { lastSortKey, createdAt, lastId } = cursor
					const dateObj = new Date(createdAt)

					whereClauses.push(
						or(
							operator(schema.playlistTracks.sortKey, lastSortKey),
							and(
								eq(schema.playlistTracks.sortKey, lastSortKey),
								operator(schema.playlistTracks.createdAt, dateObj),
							),
							and(
								eq(schema.playlistTracks.sortKey, lastSortKey),
								eq(schema.playlistTracks.createdAt, dateObj),
								operator(schema.playlistTracks.trackId, lastId),
							),
						),
					)
				}

				const data = await Sentry.startSpan(
					{ name: 'db:query:playlistTracks:paginated', op: 'db' },
					() =>
						this.db.query.playlistTracks.findMany({
							where: and(...whereClauses),
							orderBy: orderBy,
							limit: effectiveLimit + 1,
							with: {
								track: {
									with: {
										artist: true,
										bilibiliMetadata: true,
										localMetadata: true,
									},
								},
							},
						}),
				)

				return data
			})(),
			(e) =>
				e instanceof ServiceError
					? e
					: new DatabaseError('分页获取播放列表歌曲的事务失败', {
							cause: e,
						}),
		).andThen((data) => {
			const newTracks: Track[] = []
			const sortKeys: string[] = []
			for (const pt of data) {
				const t = this.trackService.formatTrack(pt.track)
				if (!t) {
					return errAsync(
						new ServiceError(
							`在格式化歌曲：${pt.track.id} 时出错，可能是原数据不存在或 source & metadata 不匹配`,
						),
					)
				}
				newTracks.push(t)
				sortKeys.push(pt.sortKey)
			}

			let nextCursor
			let nextPageFirstSortKey
			const hasMore = data.length === effectiveLimit + 1

			if (hasMore) {
				const lastItem = data[effectiveLimit - 1]
				nextCursor = {
					lastSortKey: lastItem.sortKey,
					createdAt: lastItem.createdAt.getTime(),
					lastId: lastItem.trackId,
				}
				nextPageFirstSortKey = data[effectiveLimit].sortKey
			}

			return okAsync({
				tracks: hasMore ? newTracks.slice(0, effectiveLimit) : newTracks,
				sortKeys: hasMore ? sortKeys.slice(0, effectiveLimit) : sortKeys,
				nextCursor,
				nextPageFirstSortKey,
			})
		})
	}

	/**
	 * 根据 shareId（后端 UUID）查找本地歌单
	 */
	public findPlaylistByShareId(
		shareId: string,
	): ResultAsync<typeof schema.playlists.$inferSelect | false, DatabaseError> {
		return ResultAsync.fromPromise(
			Sentry.startSpan({ name: 'db:query:playlist:byShareId', op: 'db' }, () =>
				this.db.query.playlists.findFirst({
					where: eq(schema.playlists.shareId, shareId),
				}),
			),
			(e) => new DatabaseError('根据 shareId 查找歌单失败', { cause: e }),
		).andThen((playlist) => {
			if (!playlist) return okAsync(false as const)
			return okAsync(playlist)
		})
	}

	/**
	 * 获取所有已共享（shareId 不为 null）的本地歌单
	 */
	public getSharedPlaylists(): ResultAsync<
		(typeof schema.playlists.$inferSelect)[],
		DatabaseError
	> {
		return ResultAsync.fromPromise(
			Sentry.startSpan({ name: 'db:query:playlists:shared', op: 'db' }, () =>
				this.db.query.playlists.findMany({
					where: (p, { isNotNull }) => isNotNull(p.shareId),
				}),
			),
			(e) => new DatabaseError('获取共享歌单列表失败', { cause: e }),
		)
	}
}

export const playlistService = new PlaylistService(db, trackService)
