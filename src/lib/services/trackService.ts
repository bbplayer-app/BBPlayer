import { DrizzleDB } from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { DatabaseError } from '@/lib/errors'
import type { ServiceError } from '@/lib/errors/service'
import {
	NotImplementedError,
	TrackNotFoundError,
	ValidationError,
} from '@/lib/errors/service'
import type {
	BilibiliTrack,
	LocalTrack,
	PlayRecord,
	Track,
} from '@/types/core/media'
import type {
	BilibiliMetadataPayload,
	CreateBilibiliTrackPayload,
	CreateTrackPayload,
	UpdateTrackPayload,
	UpdateTrackPayloadBase,
} from '@/types/services/track'
import log from '@/utils/log'
import { and, desc, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm'
import { Context, Effect, Layer, Option } from 'effect'
import generateUniqueTrackKey from './genKey'

const logger = log.extend('Service.Track')

type SelectTrackWithMetadata = Omit<
	typeof schema.tracks.$inferSelect,
	'playHistory'
> & {
	artist: typeof schema.artists.$inferSelect | null
	bilibiliMetadata: typeof schema.bilibiliMetadata.$inferSelect | null
	localMetadata: typeof schema.localMetadata.$inferSelect | null
}

export interface TrackServiceSignature {
	readonly formatTrack: (
		dbTrack: SelectTrackWithMetadata | undefined | null,
	) => Effect.Effect<Track, ServiceError | ValidationError>

	readonly createTrack: (
		payload: CreateTrackPayload,
	) => Effect.Effect<
		Track,
		| DatabaseError
		| ServiceError
		| ValidationError
		| TrackNotFoundError
		| NotImplementedError
	>

	readonly updateTrack: (
		payload: UpdateTrackPayload,
	) => Effect.Effect<Track, DatabaseError | ServiceError | TrackNotFoundError>

	readonly getTrackById: (
		id: number,
	) => Effect.Effect<Track, DatabaseError | TrackNotFoundError | ServiceError>

	readonly deleteTrack: (
		id: number,
	) => Effect.Effect<{ deletedId: number }, DatabaseError | TrackNotFoundError>

	readonly addPlayRecordFromTrackId: (
		trackId: number,
		record: PlayRecord,
	) => Effect.Effect<true, DatabaseError>

	readonly addPlayRecordFromUniqueKey: (
		uniqueKey: string,
		record: PlayRecord,
	) => Effect.Effect<true, DatabaseError | TrackNotFoundError>

	readonly getTrackByBilibiliMetadata: (
		bilibiliMetadata: BilibiliMetadataPayload,
	) => Effect.Effect<
		Track,
		| DatabaseError
		| TrackNotFoundError
		| ServiceError
		| ValidationError
		| NotImplementedError
	>

	readonly findOrCreateTrack: (
		payload: CreateTrackPayload,
	) => Effect.Effect<
		Track,
		| DatabaseError
		| ServiceError
		| ValidationError
		| TrackNotFoundError
		| NotImplementedError
	>

	readonly findOrCreateManyTracks: (
		payloads: CreateTrackPayload[],
		source: Track['source'],
	) => Effect.Effect<
		Map<string, number>,
		DatabaseError | ServiceError | ValidationError | NotImplementedError
	>

	readonly findTrackIdsByUniqueKeys: (
		uniqueKeys: string[],
	) => Effect.Effect<Map<string, number>, DatabaseError>

	readonly getPlayCountLeaderBoardPaginated: (options: {
		limit: number
		initialLimit?: number
		onlyCompleted?: boolean
		cursor?: { lastPlayCount: number; lastUpdatedAt: number; lastId: number }
	}) => Effect.Effect<
		{
			items: { track: Track; playCount: number }[]
			nextCursor?: {
				lastPlayCount: number
				lastUpdatedAt: number
				lastId: number
			}
		},
		DatabaseError | ServiceError
	>

	readonly getTotalPlaybackDuration: (options?: {
		onlyCompleted?: boolean
	}) => Effect.Effect<number, DatabaseError>

	readonly getTrackByUniqueKey: (
		uniqueKey: string,
	) => Effect.Effect<Track, DatabaseError | TrackNotFoundError | ServiceError>
}

export class TrackService extends Context.Tag('TrackService')<
	TrackService,
	TrackServiceSignature
>() {}

export const TrackServiceLive = Layer.effect(
	TrackService,
	Effect.gen(function* () {
		const db = yield* DrizzleDB

		const runDb = <A>(
			operation: () => Promise<A>,
			message = '数据库操作失败',
		) =>
			Effect.tryPromise({
				try: operation,
				catch: (e) => new DatabaseError({ message, cause: e }),
			})

		const formatTrackInternal = (
			dbTrack: SelectTrackWithMetadata | undefined | null,
		): Option.Option<Track> => {
			if (!dbTrack) return Option.none()

			const baseTrack = {
				id: dbTrack.id,
				uniqueKey: dbTrack.uniqueKey,
				title: dbTrack.title,
				artist: dbTrack.artist,
				coverUrl: dbTrack.coverUrl,
				duration: dbTrack.duration,
				createdAt: dbTrack.createdAt,
				source: dbTrack.source,
				updatedAt: dbTrack.updatedAt,
			}

			if (dbTrack.source === 'bilibili' && dbTrack.bilibiliMetadata) {
				return Option.some({
					...baseTrack,
					bilibiliMetadata: dbTrack.bilibiliMetadata,
				} as BilibiliTrack)
			}

			if (dbTrack.source === 'local' && dbTrack.localMetadata) {
				return Option.some({
					...baseTrack,
					localMetadata: dbTrack.localMetadata,
				} as LocalTrack)
			}

			logger.warning(`track ${dbTrack.id} 存在不一致的 source 和 metadata。`)
			return Option.none()
		}

		const findTrackIdsByUniqueKeysHelper = (uniqueKeys: string[]) =>
			Effect.gen(function* () {
				if (uniqueKeys.length === 0) {
					return new Map<string, number>()
				}
				const existingTracks = yield* runDb(
					() =>
						db.query.tracks.findMany({
							where: and(inArray(schema.tracks.uniqueKey, uniqueKeys)),
							columns: { id: true, uniqueKey: true },
						}),
					'批量查找 tracks 失败',
				).pipe(Effect.withSpan('db:query:many:tracks'))

				const map = new Map<string, number>()
				for (const track of existingTracks) {
					map.set(track.uniqueKey, track.id)
				}
				return map
			})

		const getTrackById = (id: number) =>
			Effect.gen(function* () {
				const dbTrack = yield* runDb(
					() =>
						db.query.tracks.findFirst({
							where: eq(schema.tracks.id, id),
							columns: { playHistory: false },
							with: {
								artist: true,
								bilibiliMetadata: true,
								localMetadata: true,
							},
						}),
					`查找 track 失败：${id}`,
				).pipe(Effect.withSpan('db:query:track'))

				return yield* Option.match(formatTrackInternal(dbTrack), {
					onNone: () => Effect.fail(new TrackNotFoundError({ trackId: id })),
					onSome: Effect.succeed,
				})
			})

		const _createTrack = (payload: CreateTrackPayload) =>
			Effect.gen(function* () {
				if (payload.source === 'bilibili' && !payload.bilibiliMetadata) {
					return yield* new ValidationError({
						message: '当 source 为 bilibili 时，bilibiliMetadata 不能为空。',
					})
				}
				if (payload.source === 'local' && !payload.localMetadata) {
					return yield* new ValidationError({
						message: '当 source 为 local 时，localMetadata 不能为空。',
					})
				}

				const uniqueKey = yield* generateUniqueTrackKey(payload)

				const newTrackId = yield* runDb(async () => {
					const [newTrack] = await db
						.insert(schema.tracks)
						.values({
							title: payload.title,
							source: payload.source,
							artistId: payload.artistId,
							coverUrl: payload.coverUrl,
							duration: payload.duration,
							uniqueKey: uniqueKey,
						})
						.returning({ id: schema.tracks.id })

					const trackId = newTrack.id

					if (payload.source === 'bilibili') {
						await db.insert(schema.bilibiliMetadata).values({
							trackId,
							bvid: payload.bilibiliMetadata.bvid,
							cid: payload.bilibiliMetadata.cid,
							isMultiPage: payload.bilibiliMetadata.isMultiPage,
							mainTrackTitle: payload.bilibiliMetadata.mainTrackTitle,
							videoIsValid: payload.bilibiliMetadata.videoIsValid,
						})
					} else if (payload.source === 'local') {
						await db.insert(schema.localMetadata).values({
							trackId,
							localPath: payload.localMetadata.localPath,
						})
					}
					return trackId
				}, '创建 track 事务失败').pipe(Effect.withSpan('db:insert:track'))

				return yield* getTrackById(newTrackId)
			})

		return {
			formatTrack: (dbTrack) =>
				Option.match(formatTrackInternal(dbTrack), {
					onNone: () =>
						Effect.fail(
							new ValidationError({
								message: '格式化 Track 失败，可能存在不一致的元数据',
							}),
						),
					onSome: Effect.succeed,
				}),

			createTrack: _createTrack,

			updateTrack: (payload) =>
				Effect.gen(function* () {
					const { id, ...dataToUpdate } = payload

					yield* runDb(
						() =>
							db
								.update(schema.tracks)
								.set({
									title: dataToUpdate.title ?? undefined,
									artistId: dataToUpdate.artistId,
									coverUrl: dataToUpdate.coverUrl,
									duration: dataToUpdate.duration,
								} satisfies Omit<UpdateTrackPayloadBase, 'id'>)
								.where(eq(schema.tracks.id, id)),
						`更新 track 失败：${id}`,
					).pipe(Effect.withSpan('db:update:track'))

					return yield* getTrackById(id)
				}),

			getTrackById,

			deleteTrack: (id) =>
				Effect.gen(function* () {
					const results = yield* runDb(
						() =>
							db
								.delete(schema.tracks)
								.where(eq(schema.tracks.id, id))
								.returning({ deletedId: schema.tracks.id }),
						`删除 track 失败：${id}`,
					).pipe(Effect.withSpan('db:delete:track'))

					if (!results[0]) {
						return yield* new TrackNotFoundError({ trackId: id })
					}
					return results[0]
				}),

			addPlayRecordFromTrackId: (trackId, record) =>
				Effect.gen(function* () {
					const recordJson = JSON.stringify(record)
					yield* runDb(
						() =>
							db
								.update(schema.tracks)
								.set({
									playHistory: sql`json_insert(play_history, '$[#]', json(${recordJson}))`,
								})
								.where(eq(schema.tracks.id, trackId)),
						`增加播放记录失败：${trackId}`,
					).pipe(Effect.withSpan('db:update:track:playHistory'))
					return true as const
				}),

			addPlayRecordFromUniqueKey: (uniqueKey, record) =>
				Effect.gen(function* () {
					const trackIds = yield* findTrackIdsByUniqueKeysHelper([uniqueKey])

					const trackId = trackIds.get(uniqueKey)
					if (!trackId) {
						return yield* new TrackNotFoundError({ trackId: uniqueKey })
					}

					const recordJson = JSON.stringify(record)
					yield* runDb(
						() =>
							db
								.update(schema.tracks)
								.set({
									playHistory: sql`json_insert(play_history, '$[#]', json(${recordJson}))`,
								})
								.where(eq(schema.tracks.id, trackId)),
						`增加播放记录失败：${uniqueKey}`,
					).pipe(Effect.withSpan('db:update:track:playHistory'))

					return true as const
				}),

			getTrackByBilibiliMetadata: (bilibiliMetadata) =>
				Effect.gen(function* () {
					const uniqueKey = yield* generateUniqueTrackKey({
						source: 'bilibili',
						bilibiliMetadata,
					})

					const dbTrack = yield* runDb(
						() =>
							db.query.tracks.findFirst({
								where: eq(schema.tracks.uniqueKey, uniqueKey),
								columns: { playHistory: false },
								with: {
									artist: true,
									bilibiliMetadata: true,
									localMetadata: true,
								},
							}),
						'根据 Bilibili 元数据查找 track 失败',
					).pipe(Effect.withSpan('db:query:track'))

					return yield* Option.match(formatTrackInternal(dbTrack), {
						onNone: () =>
							new TrackNotFoundError({
								trackId: `uniqueKey=${uniqueKey}`,
							}),
						onSome: Effect.succeed,
					})
				}),

			findOrCreateTrack: (payload) =>
				Effect.gen(function* () {
					const uniqueKey = yield* generateUniqueTrackKey(payload)

					const dbTrack = yield* runDb(
						() =>
							db.query.tracks.findFirst({
								where: eq(schema.tracks.uniqueKey, uniqueKey),
								columns: { playHistory: false },
								with: {
									artist: true,
									bilibiliMetadata: true,
									localMetadata: true,
								},
							}),
						'根据 uniqueKey 查找 track 失败',
					).pipe(Effect.withSpan('db:query:track'))

					// 1. 如果存在，返回
					if (dbTrack) {
						return yield* Option.match(formatTrackInternal(dbTrack), {
							onSome: Effect.succeed,
							onNone: () =>
								new ValidationError({
									message: `已存在的 track ${dbTrack.id} source 与 metadata 不匹配`,
								}),
						})
					}

					// 2. 如果不存在，创建
					return yield* _createTrack(payload)
				}),

			findOrCreateManyTracks: (payloads, source) =>
				Effect.gen(function* () {
					if (payloads.length === 0) {
						return new Map<string, number>()
					}

					// 1. 预处理 Payloads & 生成 Keys
					const processedPayloads = yield* Effect.forEach(payloads, (p) => {
						if (p.source !== source) {
							return Effect.fail(
								new ValidationError({ message: 'source 不一致' }),
							)
						}
						return generateUniqueTrackKey(p).pipe(
							Effect.map((uniqueKey) => ({ uniqueKey, payload: p })),
						)
					})

					const uniqueKeys = processedPayloads.map((p) => p.uniqueKey)

					// 2. 批量插入 (Ignore Conflict)
					const trackValuesToInsert = processedPayloads.map(
						({ uniqueKey, payload }) => ({
							title: payload.title,
							artistId: payload.artistId,
							coverUrl: payload.coverUrl,
							duration: payload.duration,
							uniqueKey: uniqueKey,
							source: payload.source,
						}),
					)

					if (trackValuesToInsert.length > 0) {
						yield* runDb(
							() =>
								db
									.insert(schema.tracks)
									.values(trackValuesToInsert)
									.onConflictDoNothing(),
							'批量插入 tracks 失败',
						).pipe(Effect.withSpan('db:insert:many:tracks'))
					}

					// 3. 重新查询获取 IDs
					const allTracks = yield* runDb(
						() =>
							db.query.tracks.findMany({
								where: and(inArray(schema.tracks.uniqueKey, uniqueKeys)),
								columns: { id: true, uniqueKey: true },
							}),
						'批量查询 tracks 失败',
					).pipe(Effect.withSpan('db:query:many:tracks'))

					const finalUniqueKeyToIdMap = new Map(
						allTracks.map((t) => [t.uniqueKey, t.id]),
					)

					// 4. 一致性检查
					if (finalUniqueKeyToIdMap.size !== uniqueKeys.length) {
						return yield* new DatabaseError({
							message:
								'创建或查找 tracks 后数据不一致，部分 track 未能成功写入或查询。',
						})
					}

					// 5. 插入 Metadata
					switch (source) {
						case 'bilibili': {
							const bilibiliMetadataValues = processedPayloads.map(
								({ uniqueKey, payload }) => {
									const trackId = finalUniqueKeyToIdMap.get(uniqueKey)!
									return {
										trackId,
										...(payload as CreateBilibiliTrackPayload).bilibiliMetadata,
									}
								},
							)

							if (bilibiliMetadataValues.length > 0) {
								yield* runDb(
									() =>
										db
											.insert(schema.bilibiliMetadata)
											.values(bilibiliMetadataValues)
											.onConflictDoNothing(),
									'批量插入 bilibiliMetadata 失败',
								).pipe(Effect.withSpan('db:insert:many:bilibiliMetadata'))
							}
							break
						}
						case 'local': {
							return yield* new NotImplementedError({
								message: '处理 local source 的逻辑尚未实现',
							})
						}
					}

					return finalUniqueKeyToIdMap
				}),

			findTrackIdsByUniqueKeys: findTrackIdsByUniqueKeysHelper,

			getPlayCountLeaderBoardPaginated: (options) =>
				Effect.gen(function* () {
					const { limit, onlyCompleted = true, cursor, initialLimit } = options
					const effectiveLimit = cursor ? limit : (initialLimit ?? limit)

					const playCountSql = onlyCompleted
						? sql<number>`(select count(*) from json_each(${schema.tracks.playHistory}) as je where json_extract(je.value, '$.completed') = 1)`
						: sql<number>`json_array_length(${schema.tracks.playHistory})`

					const whereConditions: (SQL | undefined)[] = [gt(playCountSql, 0)]

					if (cursor) {
						const cursorUpdatedAt = new Date(cursor.lastUpdatedAt)
						whereConditions.push(
							or(
								lt(playCountSql, cursor.lastPlayCount),
								and(
									eq(playCountSql, cursor.lastPlayCount),
									or(
										lt(schema.tracks.updatedAt, cursorUpdatedAt),
										and(
											eq(schema.tracks.updatedAt, cursorUpdatedAt),
											lt(schema.tracks.id, cursor.lastId),
										),
									),
								),
							),
						)
					}

					const rows = yield* runDb(
						() =>
							db.query.tracks.findMany({
								columns: { playHistory: false },
								with: {
									artist: true,
									bilibiliMetadata: true,
									localMetadata: true,
								},
								extras: {
									playCount: playCountSql.mapWith(Number).as('play_count'),
								},
								where: and(...whereConditions),
								orderBy: [
									desc(playCountSql),
									desc(schema.tracks.updatedAt),
									desc(schema.tracks.id),
								],
								limit: effectiveLimit + 1,
							}),
						'获取播放次数排行榜失败',
					).pipe(Effect.withSpan('db:query:leaderboard'))

					const hasNextPage = rows.length > effectiveLimit
					const resultItems = hasNextPage ? rows.slice(0, effectiveLimit) : rows

					const items: { track: Track; playCount: number }[] = []
					for (const row of resultItems) {
						const trackOpt = formatTrackInternal(row)
						if (Option.isSome(trackOpt)) {
							items.push({ track: trackOpt.value, playCount: row.playCount })
						}
					}

					let nextCursor
					if (hasNextPage) {
						const lastRow = resultItems[resultItems.length - 1]
						if (lastRow) {
							nextCursor = {
								lastPlayCount: lastRow.playCount,
								lastUpdatedAt: lastRow.updatedAt.getTime(),
								lastId: lastRow.id,
							}
						}
					}

					return { items, nextCursor }
				}),

			getTotalPlaybackDuration: (options) =>
				Effect.gen(function* () {
					const onlyCompleted = options?.onlyCompleted ?? true
					let totalDurationSql

					if (onlyCompleted) {
						const playCountSql = sql<number>`(select count(*) from json_each(${schema.tracks.playHistory}) as je where json_extract(je.value, '$.completed') = 1)`
						totalDurationSql = sql`sum(${schema.tracks.duration} * ${playCountSql})`
					} else {
						const durationPlayedSumPerTrack = sql`(select sum(cast(json_extract(value, '$.durationPlayed') as real)) from json_each(${schema.tracks.playHistory}))`
						totalDurationSql = sql`sum(${durationPlayedSumPerTrack})`
					}

					const rows = yield* runDb(
						() =>
							db
								.select({
									totalDuration: totalDurationSql.mapWith(Number),
								})
								.from(schema.tracks),
						'获取总播放时长失败',
					).pipe(Effect.withSpan('db:query:totalPlaybackDuration'))

					return rows[0]?.totalDuration ?? 0
				}),

			getTrackByUniqueKey: (uniqueKey) =>
				Effect.gen(function* () {
					const dbTrack = yield* runDb(
						() =>
							db.query.tracks.findFirst({
								where: eq(schema.tracks.uniqueKey, uniqueKey),
								columns: { playHistory: false },
								with: {
									artist: true,
									bilibiliMetadata: true,
									localMetadata: true,
								},
							}),
						'根据 uniqueKey 查找 track 失败',
					).pipe(Effect.withSpan('db:query:track'))

					return yield* Option.match(formatTrackInternal(dbTrack), {
						onNone: () => new TrackNotFoundError({ trackId: uniqueKey }),
						onSome: Effect.succeed,
					})
				}),
		}
	}),
)

export const trackService = Effect.serviceFunctions(TrackService)
