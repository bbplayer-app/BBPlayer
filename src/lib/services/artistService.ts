import { DrizzleDB } from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { DatabaseError } from '@/lib/errors'
import type { ServiceError } from '@/lib/errors/service'
import { ArtistNotFoundError, ValidationError } from '@/lib/errors/service'
import type { Track } from '@/types/core/media'
import type {
	CreateArtistPayload,
	UpdateArtistPayload,
} from '@/types/services/artist'
import { and, eq, or } from 'drizzle-orm'
import { Context, Effect, Layer, Option } from 'effect'
import { TrackService } from './trackService'

export interface ArtistServiceSignature {
	readonly createArtist: (
		payload: CreateArtistPayload,
	) => Effect.Effect<typeof schema.artists.$inferSelect, DatabaseError>

	readonly findOrCreateArtist: (
		payload: CreateArtistPayload,
	) => Effect.Effect<
		typeof schema.artists.$inferSelect,
		DatabaseError | ValidationError
	>

	readonly updateArtist: (
		artistId: number,
		payload: UpdateArtistPayload,
	) => Effect.Effect<
		typeof schema.artists.$inferSelect,
		DatabaseError | ArtistNotFoundError
	>

	readonly deleteArtist: (
		artistId: number,
	) => Effect.Effect<{ deletedId: number }, DatabaseError | ArtistNotFoundError>

	readonly getArtistTracks: (
		artistId: number,
	) => Effect.Effect<Track[], DatabaseError | ServiceError>

	readonly getAllArtists: () => Effect.Effect<
		(typeof schema.artists.$inferSelect)[],
		DatabaseError
	>

	readonly getArtistById: (
		artistId: number,
	) => Effect.Effect<
		Option.Option<typeof schema.artists.$inferSelect>,
		DatabaseError
	>

	readonly findOrCreateManyRemoteArtists: (
		payloads: CreateArtistPayload[],
	) => Effect.Effect<
		Map<string, typeof schema.artists.$inferSelect>,
		DatabaseError | ValidationError
	>
}

export class ArtistService extends Context.Tag('ArtistService')<
	ArtistService,
	ArtistServiceSignature
>() {}

export const ArtistServiceLive = Layer.effect(
	ArtistService,
	Effect.gen(function* () {
		const db = yield* DrizzleDB
		const trackService = yield* TrackService

		const runDb = <A>(
			operation: () => Promise<A>,
			errorDetails = '数据库操作失败',
		) =>
			Effect.tryPromise({
				try: operation,
				catch: (e) =>
					new DatabaseError({
						message: errorDetails,
						cause: e,
					}),
			})

		return {
			createArtist: (payload) =>
				runDb(
					() => db.insert(schema.artists).values(payload).returning(),
					'创建 artist 失败',
				)
					.pipe(
						Effect.map((rows) => rows[0]),
						Effect.withSpan('db:insert:artist'),
					)
					.pipe(Effect.withSpan('service:artist:createArtist')),

			findOrCreateArtist: (payload) =>
				Effect.gen(function* () {
					const { source, remoteId } = payload

					if (!source || !remoteId) {
						return yield* new ValidationError({
							message: 'source 和 remoteId 在此方法中是必需的',
						})
					}

					const existingArtist = yield* runDb(
						() =>
							db.query.artists.findFirst({
								where: and(
									eq(schema.artists.source, source),
									eq(schema.artists.remoteId, remoteId),
								),
							}),
						'查找 artist 失败',
					).pipe(Effect.withSpan('db:query:artist'))

					if (existingArtist) {
						return existingArtist
					}

					const newArtists = yield* runDb(
						() => db.insert(schema.artists).values(payload).returning(),
						'创建 artist 事务失败',
					).pipe(Effect.withSpan('db:insert:artist'))

					return newArtists[0]
				}).pipe(Effect.withSpan('service:artist:findOrCreateArtist')),

			updateArtist: (artistId, payload) =>
				Effect.gen(function* () {
					const existing = yield* runDb(
						() =>
							db.query.artists.findFirst({
								where: eq(schema.artists.id, artistId),
								columns: { id: true },
							}),
						'检查 artist 是否存在失败',
					).pipe(Effect.withSpan('db:query:artist:exist'))

					if (!existing) {
						return yield* Effect.fail(new ArtistNotFoundError({ artistId }))
					}

					const updated = yield* runDb(
						() =>
							db
								.update(schema.artists)
								.set({
									name: payload.name ?? undefined,
									avatarUrl: payload.avatarUrl,
									signature: payload.signature,
								})
								.where(eq(schema.artists.id, artistId))
								.returning(),
						`更新 artist ${artistId} 失败`,
					).pipe(Effect.withSpan('db:update:artist'))

					return updated[0]
				}).pipe(Effect.withSpan('service:artist:updateArtist')),

			deleteArtist: (artistId) =>
				Effect.gen(function* () {
					// 检查是否存在
					const existing = yield* runDb(
						() =>
							db.query.artists.findFirst({
								where: eq(schema.artists.id, artistId),
								columns: { id: true },
							}),
						'检查 artist 是否存在失败',
					)

					if (!existing) {
						return yield* Effect.fail(new ArtistNotFoundError({ artistId }))
					}

					const deleted = yield* runDb(
						() =>
							db
								.delete(schema.artists)
								.where(eq(schema.artists.id, artistId))
								.returning({ deletedId: schema.artists.id }),
						`删除 artist ${artistId} 失败`,
					).pipe(Effect.withSpan('db:delete:artist'))

					return deleted[0]
				}).pipe(Effect.withSpan('service:artist:deleteArtist')),

			getArtistTracks: (artistId) =>
				Effect.gen(function* () {
					const dbTracks = yield* runDb(
						() =>
							db.query.tracks.findMany({
								where: eq(schema.tracks.artistId, artistId),
								with: {
									artist: true,
									bilibiliMetadata: true,
									localMetadata: true,
								},
							}),
						`获取 artist ${artistId} 的歌曲失败`,
					).pipe(Effect.withSpan('db:query:tracks:byArtist'))

					const formattedTracks = yield* Effect.forEach(dbTracks, (track) =>
						trackService.formatTrack(track).pipe(
							Effect.mapError(
								(e) =>
									new DatabaseError({
										message: `格式化失败: ${e.message}`,
										cause: e,
									}),
							),
						),
					)

					return formattedTracks
				}).pipe(Effect.withSpan('service:artist:getArtistTracks')),

			getAllArtists: () =>
				runDb(() => db.query.artists.findMany(), '获取所有 artist 列表失败')
					.pipe(Effect.withSpan('db:query:artists'))
					.pipe(Effect.withSpan('service:artist:getAllArtists')),

			getArtistById: (artistId) =>
				runDb(
					() =>
						db.query.artists.findFirst({
							where: eq(schema.artists.id, artistId),
						}),
					`通过 ID ${artistId} 获取 artist 失败`,
				)
					.pipe(
						Effect.map(Option.fromNullable),
						Effect.withSpan('db:query:artist'),
					)
					.pipe(Effect.withSpan('service:artist:getArtistById')),

			findOrCreateManyRemoteArtists: (payloads) =>
				Effect.gen(function* () {
					if (payloads.length === 0) {
						return new Map()
					}

					for (const p of payloads) {
						if (!p.source || !p.remoteId) {
							return yield* Effect.fail(
								new ValidationError({
									message: 'payloads 中存在 source 或 remoteId 为空的对象',
								}),
							)
						}
					}

					yield* runDb(
						() =>
							db.insert(schema.artists).values(payloads).onConflictDoNothing(),
						'批量插入 artists 失败',
					).pipe(Effect.withSpan('db:insert:many:artists'))

					const findConditions = payloads.map((p) =>
						and(
							eq(schema.artists.source, p.source),
							eq(schema.artists.remoteId, p.remoteId!),
						),
					)

					const allArtists = yield* runDb(
						() =>
							db.query.artists.findMany({
								where: or(...findConditions),
							}),
						'批量查询 artists 失败',
					).pipe(Effect.withSpan('db:query:many:artists'))

					return yield* Effect.try({
						try: () => {
							const resultMap = new Map<
								string,
								typeof schema.artists.$inferSelect
							>()
							for (const p of payloads) {
								const existing = allArtists.find(
									(a) =>
										`${a.source}::${a.remoteId}` ===
										`${p.source}::${p.remoteId}`,
								)
								if (!existing) {
									throw new Error(
										`数据不一致，未找到 artist: ${p.source}::${p.remoteId}`,
									)
								}
								resultMap.set(p.remoteId!, existing)
							}
							return resultMap
						},
						catch: (e) =>
							new DatabaseError({
								message: '批量处理后数据校验失败',
								cause: e,
							}),
					})
				}).pipe(
					Effect.withSpan('service:artist:findOrCreateManyRemoteArtists'),
				),
		}
	}),
)
