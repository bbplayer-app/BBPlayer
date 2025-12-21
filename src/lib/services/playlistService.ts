import { DrizzleDB } from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { DatabaseError, ServiceError } from '@/lib/errors'
import {
	PlaylistNotFoundError,
	TrackNotInPlaylistError,
	ValidationError,
} from '@/lib/errors/service'
import type { Playlist, Track } from '@/types/core/media'
import type {
	CreatePlaylistPayload,
	ReorderSingleTrackPayload,
	UpdatePlaylistPayload,
} from '@/types/services/playlist'
import {
	and,
	asc,
	desc,
	eq,
	gt,
	inArray,
	like,
	lt,
	or,
	sql,
	type SQL,
} from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { TrackService } from './trackService'

export interface PlaylistServiceSignature {
	readonly createPlaylist: (
		payload: CreatePlaylistPayload,
	) => Effect.Effect<typeof schema.playlists.$inferSelect, DatabaseError>

	readonly updatePlaylistMetadata: (
		playlistId: number,
		payload: UpdatePlaylistPayload,
	) => Effect.Effect<
		typeof schema.playlists.$inferSelect,
		DatabaseError | PlaylistNotFoundError
	>

	readonly deletePlaylist: (
		playlistId: number,
	) => Effect.Effect<
		{ deletedId: number },
		DatabaseError | PlaylistNotFoundError
	>

	readonly addManyTracksToLocalPlaylist: (
		playlistId: number,
		trackIds: number[],
	) => Effect.Effect<
		(typeof schema.playlistTracks.$inferSelect)[],
		DatabaseError | PlaylistNotFoundError
	>

	readonly batchRemoveTracksFromLocalPlaylist: (
		playlistId: number,
		trackIdList: number[],
	) => Effect.Effect<
		{ removedTrackIds: number[]; missingTrackIds: number[] },
		DatabaseError | PlaylistNotFoundError | TrackNotInPlaylistError
	>

	readonly reorderSingleLocalPlaylistTrack: (
		playlistId: number,
		payload: ReorderSingleTrackPayload,
	) => Effect.Effect<true, DatabaseError | PlaylistNotFoundError | ServiceError>

	readonly getPlaylistTracks: (
		playlistId: number,
	) => Effect.Effect<
		Track[],
		DatabaseError | PlaylistNotFoundError | ServiceError | ValidationError
	>

	readonly getAllPlaylists: () => Effect.Effect<
		(typeof schema.playlists.$inferSelect & {
			author: typeof schema.artists.$inferSelect | null
		})[],
		DatabaseError
	>

	readonly getPlaylistMetadata: (playlistId: number) => Effect.Effect<
		| (typeof schema.playlists.$inferSelect & {
				author: typeof schema.artists.$inferSelect | null
		  } & {
				validTrackCount: number
		  })
		| undefined,
		DatabaseError
	>

	readonly findOrCreateRemotePlaylist: (
		payload: CreatePlaylistPayload,
	) => Effect.Effect<
		typeof schema.playlists.$inferSelect,
		DatabaseError | ValidationError
	>

	readonly replacePlaylistAllTracks: (
		playlistId: number,
		trackIds: number[],
	) => Effect.Effect<true, DatabaseError>

	readonly findPlaylistByTypeAndRemoteId: (
		type: Playlist['type'],
		remoteId: number,
	) => Effect.Effect<
		| (typeof schema.playlists.$inferSelect & {
				trackLinks: (typeof schema.playlistTracks.$inferSelect)[]
		  })
		| undefined,
		DatabaseError
	>

	readonly getPlaylistById: (playlistId: number) => Effect.Effect<
		| (typeof schema.playlists.$inferSelect & {
				author: typeof schema.artists.$inferSelect | null
				trackLinks: (typeof schema.playlistTracks.$inferSelect)[]
		  })
		| undefined,
		DatabaseError
	>

	readonly getLocalPlaylistsContainingTrackByUniqueKey: (
		uniqueKey: string,
	) => Effect.Effect<(typeof schema.playlists.$inferSelect)[], DatabaseError>

	readonly getLocalPlaylistsContainingTrackById: (
		trackId: number,
	) => Effect.Effect<(typeof schema.playlists.$inferSelect)[], DatabaseError>

	readonly searchTrackInPlaylist: (
		playlistId: number,
		query: string,
	) => Effect.Effect<Track[], DatabaseError | ServiceError | ValidationError>

	readonly getPlaylistTracksPaginated: (options: {
		playlistId: number
		initialLimit?: number
		limit: number
		cursor:
			| {
					lastOrder: number
					createdAt: number
					lastId: number
			  }
			| undefined
	}) => Effect.Effect<
		{
			tracks: Track[]
			nextCursor?: {
				lastOrder: number
				createdAt: number
				lastId: number
			}
		},
		DatabaseError | PlaylistNotFoundError | ServiceError | ValidationError
	>
}

export class PlaylistService extends Context.Tag('PlaylistService')<
	PlaylistService,
	PlaylistServiceSignature
>() {}

export const PlaylistServiceLive = Layer.effect(
	PlaylistService,
	Effect.gen(function* () {
		const db = yield* DrizzleDB
		const trackService = yield* TrackService

		const runDb = <A>(
			operation: () => Promise<A>,
			message = '数据库操作失败',
		) =>
			Effect.tryPromise({
				try: operation,
				catch: (e) => new DatabaseError({ message, cause: e }),
			})

		return {
			createPlaylist: (payload) =>
				runDb(
					() =>
						db
							.insert(schema.playlists)
							.values({
								title: payload.title,
								authorId: payload.authorId,
								description: payload.description,
								coverUrl: payload.coverUrl,
								type: payload.type,
								remoteSyncId: payload.remoteSyncId,
							} satisfies CreatePlaylistPayload)
							.returning(),
					'创建播放列表失败',
				).pipe(
					Effect.map((rows) => rows[0]),
					Effect.withSpan('db:insert:playlist'),
					Effect.withSpan('service:playlist:createPlaylist'),
				),

			updatePlaylistMetadata: (playlistId, payload) =>
				Effect.gen(function* () {
					const existing = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								where: and(eq(schema.playlists.id, playlistId)),
							}),
						'检查播放列表是否存在失败',
					).pipe(Effect.withSpan('db:query:playlist:exist'))

					if (!existing) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const updated = yield* runDb(
						() =>
							db
								.update(schema.playlists)
								.set({
									title: payload.title ?? undefined,
									description: payload.description,
									coverUrl: payload.coverUrl,
								} satisfies UpdatePlaylistPayload)
								.where(eq(schema.playlists.id, playlistId))
								.returning(),
						`更新播放列表 ${playlistId} 失败`,
					).pipe(Effect.withSpan('db:update:playlist'))

					return updated[0]
				}).pipe(Effect.withSpan('service:playlist:updatePlaylistMetadata')),

			deletePlaylist: (playlistId) =>
				Effect.gen(function* () {
					const existing = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								where: and(eq(schema.playlists.id, playlistId)),
								columns: { id: true },
							}),
						'检查播放列表是否存在失败',
					).pipe(Effect.withSpan('db:query:playlist:exist'))

					if (!existing) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const deleted = yield* runDb(
						() =>
							db
								.delete(schema.playlists)
								.where(eq(schema.playlists.id, playlistId))
								.returning({ deletedId: schema.playlists.id }),
						`删除播放列表 ${playlistId} 失败`,
					).pipe(Effect.withSpan('db:delete:playlist'))

					return deleted[0]
				}).pipe(Effect.withSpan('service:playlist:deletePlaylist')),

			addManyTracksToLocalPlaylist: (playlistId, trackIds) =>
				Effect.gen(function* () {
					if (trackIds.length === 0) {
						return []
					}

					const playlist = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								where: and(
									eq(schema.playlists.id, playlistId),
									eq(schema.playlists.type, 'local'),
								),
								columns: { id: true, itemCount: true },
							}),
						'检查播放列表是否存在失败',
					).pipe(Effect.withSpan('db:query:playlist:exist'))

					if (!playlist) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const maxOrderResult = yield* runDb(
						() =>
							db
								.select({
									maxOrder: sql<
										number | null
									>`MAX(${schema.playlistTracks.order})`,
								})
								.from(schema.playlistTracks)
								.where(eq(schema.playlistTracks.playlistId, playlistId)),
						'获取最大 order 失败',
					).pipe(Effect.withSpan('db:query:max_order'))

					let nextOrder = (maxOrderResult[0].maxOrder ?? -1) + 1

					const values = trackIds.map((tid) => ({
						playlistId,
						trackId: tid,
						order: nextOrder++,
					}))

					const inserted = yield* runDb(
						() =>
							db
								.insert(schema.playlistTracks)
								.values(values)
								.onConflictDoNothing({
									target: [
										schema.playlistTracks.playlistId,
										schema.playlistTracks.trackId,
									],
								})
								.returning(),
						'批量添加歌曲到播放列表失败',
					).pipe(Effect.withSpan('db:insert:playlistTracks'))

					if (inserted.length > 0) {
						yield* runDb(
							() =>
								db
									.update(schema.playlists)
									.set({
										itemCount: sql`${schema.playlists.itemCount} + ${inserted.length}`,
									})
									.where(eq(schema.playlists.id, playlistId)),
							'更新播放列表 itemCount 失败',
						).pipe(Effect.withSpan('db:update:playlist:itemCount'))
					}

					return inserted
				}).pipe(
					Effect.withSpan('service:playlist:addManyTracksToLocalPlaylist'),
				),

			batchRemoveTracksFromLocalPlaylist: (playlistId, trackIdList) =>
				Effect.gen(function* () {
					if (trackIdList.length === 0) {
						return { removedTrackIds: [], missingTrackIds: [] }
					}

					const playlist = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								where: and(
									eq(schema.playlists.id, playlistId),
									eq(schema.playlists.type, 'local'),
								),
								columns: { id: true },
							}),
						'检查播放列表是否存在失败',
					).pipe(Effect.withSpan('db:query:playlist:exist'))

					if (!playlist) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const deletedLinks = yield* runDb(
						() =>
							db
								.delete(schema.playlistTracks)
								.where(
									and(
										eq(schema.playlistTracks.playlistId, playlistId),
										inArray(schema.playlistTracks.trackId, trackIdList),
									),
								)
								.returning({ trackId: schema.playlistTracks.trackId }),
						'批量删除播放列表歌曲失败',
					).pipe(Effect.withSpan('db:delete:playlistTracks'))

					const removedTrackIds = deletedLinks.map((x) => x.trackId)
					const removedCount = removedTrackIds.length

					if (removedCount === 0) {
						return yield* new TrackNotInPlaylistError({
							trackId: trackIdList[0],
							playlistId,
						})
					}

					yield* runDb(
						() =>
							db
								.update(schema.playlists)
								.set({
									itemCount: sql`MAX(0, ${schema.playlists.itemCount} - ${removedCount})`,
								})
								.where(eq(schema.playlists.id, playlistId)),
						'更新播放列表 itemCount 失败',
					).pipe(Effect.withSpan('db:update:playlist:itemCount'))

					const removedSet = new Set(removedTrackIds)
					const missingTrackIds = trackIdList.filter(
						(id) => !removedSet.has(id),
					)

					return { removedTrackIds, missingTrackIds }
				}).pipe(
					Effect.withSpan(
						'service:playlist:batchRemoveTracksFromLocalPlaylist',
					),
				),

			reorderSingleLocalPlaylistTrack: (playlistId, payload) =>
				Effect.gen(function* () {
					const { trackId, fromOrder, toOrder } = payload

					if (fromOrder === toOrder) {
						return true as const
					}

					const playlist = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								where: and(
									eq(schema.playlists.id, playlistId),
									eq(schema.playlists.type, 'local'),
								),
								columns: { id: true },
							}),
						'检查播放列表是否存在失败',
					).pipe(Effect.withSpan('db:query:playlist:exist'))

					if (!playlist) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const trackToMove = yield* runDb(
						() =>
							db.query.playlistTracks.findFirst({
								where: and(
									eq(schema.playlistTracks.playlistId, playlistId),
									eq(schema.playlistTracks.trackId, trackId),
									eq(schema.playlistTracks.order, fromOrder),
								),
							}),
						'获取待移动歌曲失败',
					).pipe(Effect.withSpan('db:query:playlistTrack'))

					if (!trackToMove) {
						return yield* new ServiceError({
							message: `数据不一致：歌曲 ${trackId} 不在播放列表 ${playlistId} 的 ${fromOrder} 位置。`,
						})
					}

					if (toOrder > fromOrder) {
						yield* runDb(
							() =>
								db
									.update(schema.playlistTracks)
									.set({
										order: sql`${schema.playlistTracks.order} - 1`,
									})
									.where(
										and(
											eq(schema.playlistTracks.playlistId, playlistId),
											sql`${schema.playlistTracks.order} > ${fromOrder}`,
											sql`${schema.playlistTracks.order} <= ${toOrder}`,
										),
									),
							'更新歌曲顺序失败 (Up)',
						).pipe(Effect.withSpan('db:update:playlistTracks:reorder'))
					} else {
						yield* runDb(
							() =>
								db
									.update(schema.playlistTracks)
									.set({
										order: sql`${schema.playlistTracks.order} + 1`,
									})
									.where(
										and(
											eq(schema.playlistTracks.playlistId, playlistId),
											sql`${schema.playlistTracks.order} >= ${toOrder}`,
											sql`${schema.playlistTracks.order} < ${fromOrder}`,
										),
									),
							'更新歌曲顺序失败 (Down)',
						).pipe(Effect.withSpan('db:update:playlistTracks:reorder'))
					}

					yield* runDb(
						() =>
							db
								.update(schema.playlistTracks)
								.set({ order: toOrder })
								.where(
									and(
										eq(schema.playlistTracks.playlistId, playlistId),
										eq(schema.playlistTracks.trackId, trackId),
									),
								),
						'更新目标歌曲顺序失败',
					).pipe(Effect.withSpan('db:update:playlistTrack:order'))

					return true as const
				}).pipe(
					Effect.withSpan('service:playlist:reorderSingleLocalPlaylistTrack'),
				),

			getPlaylistTracks: (playlistId) =>
				Effect.gen(function* () {
					const type = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								columns: { type: true },
								where: eq(schema.playlists.id, playlistId),
							}),
						'检查播放列表类型失败',
					).pipe(Effect.withSpan('db:query:playlist:type'))

					if (!type) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const orderBy =
						type.type === 'local'
							? desc(schema.playlistTracks.order)
							: asc(schema.playlistTracks.order)

					const data = yield* runDb(
						() =>
							db.query.playlistTracks.findMany({
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
						'获取播放列表歌曲失败',
					).pipe(Effect.withSpan('db:query:playlistTracks'))

					const newTracks = yield* Effect.forEach(data, (trackLink) =>
						trackService.formatTrack(trackLink.track).pipe(
							Effect.mapError(
								(e) =>
									new ServiceError({
										message: `在格式化歌曲：${trackLink.track.id} 时出错`,
										cause: e,
									}),
							),
						),
					)

					return newTracks
				}).pipe(Effect.withSpan('service:playlist:getPlaylistTracks')),

			getAllPlaylists: () =>
				runDb(
					() =>
						db.query.playlists.findMany({
							orderBy: desc(schema.playlists.updatedAt),
							with: {
								author: true,
							},
						}),
					'获取所有 playlists 失败',
				).pipe(
					Effect.withSpan('db:query:playlists'),
					Effect.withSpan('service:playlist:getAllPlaylists'),
				),

			getPlaylistMetadata: (playlistId) =>
				runDb(
					() =>
						db.query.playlists.findFirst({
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
            WHERE pt.playlist_id = ${schema.playlists.id}
              AND (bm.video_is_valid IS NOT false)
          )`.as('valid_track_count'),
							},
						}),
					'获取 playlist 元数据失败',
				).pipe(
					Effect.withSpan('db:query:playlist'),
					Effect.withSpan('service:playlist:getPlaylistMetadata'),
				),

			findOrCreateRemotePlaylist: (payload) =>
				Effect.gen(function* () {
					const { remoteSyncId, type } = payload
					if (!remoteSyncId || type === 'local') {
						return yield* new ValidationError({
							message:
								'无效的 remoteSyncId 或 type，调用 findOrCreateRemotePlaylist 时必须提供 remoteSyncId 和非 local 的 type',
						})
					}

					const existingPlaylist = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								where: and(
									eq(schema.playlists.remoteSyncId, remoteSyncId),
									eq(schema.playlists.type, type),
								),
							}),
						'查找播放列表失败',
					).pipe(Effect.withSpan('db:query:playlist'))

					if (existingPlaylist) {
						return existingPlaylist
					}

					const newPlaylist = yield* runDb(
						() =>
							db
								.insert(schema.playlists)
								.values({
									title: payload.title,
									authorId: payload.authorId,
									description: payload.description,
									coverUrl: payload.coverUrl,
									type: payload.type,
									remoteSyncId: payload.remoteSyncId,
								} satisfies CreatePlaylistPayload)
								.returning(),
						'创建播放列表失败',
					).pipe(Effect.withSpan('db:insert:playlist'))

					return newPlaylist[0]
				}).pipe(Effect.withSpan('service:playlist:findOrCreateRemotePlaylist')),

			replacePlaylistAllTracks: (playlistId, trackIds) =>
				Effect.gen(function* () {
					yield* runDb(
						() =>
							db
								.delete(schema.playlistTracks)
								.where(eq(schema.playlistTracks.playlistId, playlistId)),
						'删除旧歌曲链接失败',
					).pipe(Effect.withSpan('db:delete:playlistTracks'))

					if (trackIds.length > 0) {
						const newPlaylistTracks = trackIds.map((id, index) => ({
							playlistId: playlistId,
							trackId: id,
							order: index,
						}))
						yield* runDb(
							() => db.insert(schema.playlistTracks).values(newPlaylistTracks),
							'插入新歌曲链接失败',
						).pipe(Effect.withSpan('db:insert:playlistTracks'))
					}

					yield* runDb(
						() =>
							db
								.update(schema.playlists)
								.set({
									itemCount: trackIds.length,
									lastSyncedAt: new Date(),
								})
								.where(eq(schema.playlists.id, playlistId)),
						'更新播放列表元数据失败',
					).pipe(Effect.withSpan('db:update:playlist'))

					return true as const
				}).pipe(Effect.withSpan('service:playlist:replacePlaylistAllTracks')),

			findPlaylistByTypeAndRemoteId: (type, remoteId) =>
				runDb(
					() =>
						db.query.playlists.findFirst({
							where: and(
								eq(schema.playlists.type, type),
								eq(schema.playlists.remoteSyncId, remoteId),
							),
							with: {
								trackLinks: true,
							},
						}),
					'查询播放列表失败',
				).pipe(
					Effect.withSpan('db:query:playlist'),
					Effect.withSpan('service:playlist:findPlaylistByTypeAndRemoteId'),
				),

			getPlaylistById: (playlistId) =>
				runDb(
					() =>
						db.query.playlists.findFirst({
							where: eq(schema.playlists.id, playlistId),
							with: {
								author: true,
								trackLinks: true,
							},
						}),
					'查询播放列表失败',
				).pipe(
					Effect.withSpan('db:query:playlist'),
					Effect.withSpan('service:playlist:getPlaylistById'),
				),

			getLocalPlaylistsContainingTrackByUniqueKey: (uniqueKey) =>
				Effect.gen(function* () {
					const trackIds = yield* trackService.findTrackIdsByUniqueKeys([
						uniqueKey,
					])
					if (!trackIds.has(uniqueKey)) {
						return []
					}
					const trackId = trackIds.get(uniqueKey)!

					return yield* runDb(
						() =>
							db.query.playlists.findMany({
								where: and(
									eq(schema.playlists.type, 'local'),
									inArray(
										schema.playlists.id,
										db
											.select({
												playlistId: schema.playlistTracks.playlistId,
											})
											.from(schema.playlistTracks)
											.where(eq(schema.playlistTracks.trackId, trackId)),
									),
								),
							}),
						'获取包含该歌曲的本地播放列表失败',
					).pipe(Effect.withSpan('db:query:playlists'))
				}).pipe(
					Effect.withSpan(
						'service:playlist:getLocalPlaylistsContainingTrackByUniqueKey',
					),
				),

			getLocalPlaylistsContainingTrackById: (trackId) =>
				runDb(
					() =>
						db.query.playlists.findMany({
							where: and(
								eq(schema.playlists.type, 'local'),
								inArray(
									schema.playlists.id,
									db
										.select({
											playlistId: schema.playlistTracks.playlistId,
										})
										.from(schema.playlistTracks)
										.where(eq(schema.playlistTracks.trackId, trackId)),
								),
							),
						}),
					'获取包含该歌曲的本地播放列表失败',
				).pipe(
					Effect.withSpan('db:query:playlists'),
					Effect.withSpan(
						'service:playlist:getLocalPlaylistsContainingTrackById',
					),
				),

			searchTrackInPlaylist: (playlistId, query) =>
				Effect.gen(function* () {
					const q = `%${query.trim().toLowerCase()}%`

					const trackIdSubq = db
						.select({ id: schema.tracks.id })
						.from(schema.tracks)
						.leftJoin(
							schema.artists,
							eq(schema.tracks.artistId, schema.artists.id),
						)
						.where(like(sql`lower(${schema.tracks.title})`, q))

					const rows = yield* runDb(
						() =>
							db.query.playlistTracks.findMany({
								where: and(
									eq(schema.playlistTracks.playlistId, playlistId),
									inArray(schema.playlistTracks.trackId, trackIdSubq),
								),
								with: {
									track: {
										columns: {
											playHistory: false,
										},
										with: {
											artist: true,
											bilibiliMetadata: true,
											localMetadata: true,
										},
									},
								},
								orderBy: asc(schema.playlistTracks.order),
							}),
						'搜索歌曲失败',
					).pipe(Effect.withSpan('db:query:playlistTracks'))

					return yield* Effect.forEach(rows, (row) =>
						trackService.formatTrack(row.track).pipe(
							Effect.mapError(
								(e) =>
									new ServiceError({
										message: `在格式化歌曲：${row.track.id} 时出错`,
										cause: e,
									}),
							),
						),
					)
				}).pipe(Effect.withSpan('service:playlist:searchTrackInPlaylist')),

			getPlaylistTracksPaginated: (options) =>
				Effect.gen(function* () {
					const { limit, cursor, playlistId, initialLimit } = options
					const effectiveLimit = cursor ? limit : (initialLimit ?? limit)

					const playlist = yield* runDb(
						() =>
							db.query.playlists.findFirst({
								columns: { type: true },
								where: eq(schema.playlists.id, playlistId),
							}),
						'检查播放列表类型失败',
					).pipe(Effect.withSpan('db:query:playlist:type'))

					if (!playlist) {
						return yield* new PlaylistNotFoundError({ playlistId })
					}

					const isDesc = playlist.type === 'local'
					const sortDirection = isDesc ? desc : asc
					const operator = isDesc ? lt : gt

					const orderBy = [
						sortDirection(schema.playlistTracks.order),
						sortDirection(schema.playlistTracks.createdAt),
						sortDirection(schema.playlistTracks.trackId),
					]

					const whereClauses: (SQL | undefined)[] = [
						eq(schema.playlistTracks.playlistId, playlistId),
					]

					if (cursor) {
						const { lastOrder, createdAt, lastId } = cursor
						const dateObj = new Date(createdAt)

						whereClauses.push(
							or(
								operator(schema.playlistTracks.order, lastOrder),
								and(
									eq(schema.playlistTracks.order, lastOrder),
									operator(schema.playlistTracks.createdAt, dateObj),
								),
								and(
									eq(schema.playlistTracks.order, lastOrder),
									eq(schema.playlistTracks.createdAt, dateObj),
									operator(schema.playlistTracks.trackId, lastId),
								),
							),
						)
					}

					const data = yield* runDb(
						() =>
							db.query.playlistTracks.findMany({
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
										columns: {
											playHistory: false,
										},
									},
								},
							}),
						'分页获取播放列表歌曲失败',
					).pipe(Effect.withSpan('db:query:playlistTracks:paginated'))

					const newTracks = yield* Effect.forEach(data, (pt) =>
						trackService.formatTrack(pt.track).pipe(
							Effect.mapError(
								(e) =>
									new ServiceError({
										message: `在格式化歌曲：${pt.track.id} 时出错`,
										cause: e,
									}),
							),
						),
					)

					let nextCursor
					const hasMore = data.length === effectiveLimit + 1

					if (hasMore) {
						const lastItem = data[effectiveLimit - 1]
						nextCursor = {
							lastOrder: lastItem.order,
							createdAt: lastItem.createdAt.getTime(),
							lastId: lastItem.trackId,
						}
					}

					return {
						tracks: hasMore ? newTracks.slice(0, effectiveLimit) : newTracks,
						nextCursor,
					}
				}).pipe(Effect.withSpan('service:playlist:getPlaylistTracksPaginated')),
		}
	}),
)
