import { arktypeValidator } from '@hono/arktype-validator'
import { and, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { createDb } from '../db'
import type { DrizzleDb } from '../db'
import {
	playlistMembers,
	sharedPlaylists,
	sharedPlaylistTracks,
	sharedTracks,
	users,
} from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { ChangeEvent, JwtTokenPayload, TrackInput } from '../types'
import {
	createPlaylistRequestSchema,
	getPlaylistChangesRequestSchema,
	playlistChangesRequestSchema,
	updatePlaylistRequestSchema,
} from '../validators/playlists'

const validationHook: Parameters<typeof arktypeValidator>[2] = (result, c) => {
	if (!result.success) {
		return c.json(
			{ error: 'invalid_body', summary: result.errors.summary },
			400,
		)
	}
}

type HonoEnv = {
	Bindings: Env
	Variables: { jwtPayload: JwtTokenPayload }
}

const playlistsRoute = new Hono<HonoEnv>()
	.use('*', authMiddleware)
	.post(
		'/',
		arktypeValidator('json', createPlaylistRequestSchema, validationHook),
		async (c) => {
			const { sub } = c.var.jwtPayload
			const mid = sub
			const body = c.req.valid('json')
			const { db, client } = createDb(c.env.DATABASE_URL)

			// 创建歌单
			const [playlist] = await db
				.insert(sharedPlaylists)
				.values({
					ownerMid: mid,
					title: body.title,
					description: body.description,
					coverUrl: body.cover_url,
				})
				.returning()

			// 将创建者写入 playlist_members（role=owner）
			await db.insert(playlistMembers).values({
				playlistId: playlist.id,
				mid,
				role: 'owner',
			})

			// 可选：携带初始曲目
			if (body.tracks?.length) {
				await upsertTracks(db, playlist.id, mid, body.tracks)
			}

			c.executionCtx.waitUntil(client.end())
			return c.json({ playlist }, 201)
		},
	)
	.patch(
		'/:id',
		arktypeValidator('json', updatePlaylistRequestSchema, validationHook),
		async (c) => {
			const { sub } = c.var.jwtPayload
			const mid = sub
			const playlistId = c.req.param('id')
			const body = c.req.valid('json')
			const { db, client } = createDb(c.env.DATABASE_URL)

			// 权限校验
			const member = await getMember(db, playlistId, mid)
			if (!member || member.role !== 'owner') {
				return c.json({ error: 'Forbidden' }, 403)
			}

			const [updated] = await db
				.update(sharedPlaylists)
				.set({
					...(body.title !== undefined ? { title: body.title } : {}),
					...(body.description !== undefined
						? { description: body.description }
						: {}),
					...(body.cover_url !== undefined ? { coverUrl: body.cover_url } : {}),
					updatedAt: new Date(),
				})
				.where(eq(sharedPlaylists.id, playlistId))
				.returning()

			c.executionCtx.waitUntil(client.end())
			return c.json({ playlist: updated })
		},
	)
	.post(
		'/:id/changes',
		arktypeValidator('json', playlistChangesRequestSchema, validationHook),
		async (c) => {
			const { sub } = c.var.jwtPayload
			const mid = sub
			const playlistId = c.req.param('id')
			const { changes } = c.req.valid('json')
			const { db, client } = createDb(c.env.DATABASE_URL)

			const member = await getMember(db, playlistId, mid)
			if (!member || member.role === 'subscriber') {
				return c.json({ error: 'Forbidden' }, 403)
			}

			if (changes.length === 0) {
				return c.json({ error: 'changes array is required' }, 400)
			}

			// 按 operation_at 升序排列，确保 LWW 顺序正确
			const sorted = [...changes].sort(
				(a, b) => a.operation_at - b.operation_at,
			)

			const upsertChanges = sorted.filter((c) => c.op === 'upsert')
			const removeChanges = sorted.filter((c) => c.op === 'remove')
			const reorderChanges = sorted.filter((c) => c.op === 'reorder')

			await db.transaction(async (tx) => {
				// 1. 批量 upsert shared_tracks（资源池）
				if (upsertChanges.length > 0) {
					await tx
						.insert(sharedTracks)
						.values(
							upsertChanges.map((c) => ({
								uniqueKey: c.track.unique_key,
								title: c.track.title,
								artistName: c.track.artist_name,
								artistId: c.track.artist_id,
								coverUrl: c.track.cover_url,
								duration: c.track.duration,
								bilibiliBvid: c.track.bilibili_bvid,
								bilibiliCid: c.track.bilibili_cid,
							})),
						)
						.onConflictDoUpdate({
							target: sharedTracks.uniqueKey,
							set: {
								title: sql`excluded.title`,
								artistName: sql`excluded.artist_name`,
								coverUrl: sql`excluded.cover_url`,
								updatedAt: sql`excluded.updated_at`,
							},
						})

					// 2. 批量 upsert shared_playlist_tracks（LWW：用 excluded.updated_at 逐行比较）
					await tx
						.insert(sharedPlaylistTracks)
						.values(
							upsertChanges.map((c) => ({
								playlistId,
								trackUniqueKey: c.track.unique_key,
								sortKey: c.sort_key,
								addedByMid: mid,
								updatedAt: new Date(c.operation_at),
								deletedAt: null,
							})),
						)
						.onConflictDoUpdate({
							target: [
								sharedPlaylistTracks.playlistId,
								sharedPlaylistTracks.trackUniqueKey,
							],
							set: {
								sortKey: sql`excluded.sort_key`,
								updatedAt: sql`excluded.updated_at`,
								deletedAt: null,
							},
							setWhere: lt(
								sharedPlaylistTracks.updatedAt,
								sql`excluded.updated_at`,
							),
						})
				}

				// 3. remove（LWW 软删除）
				for (const change of removeChanges) {
					await tx
						.update(sharedPlaylistTracks)
						.set({ deletedAt: new Date(change.operation_at) })
						.where(
							and(
								eq(sharedPlaylistTracks.playlistId, playlistId),
								eq(
									sharedPlaylistTracks.trackUniqueKey,
									change.track_unique_key,
								),
								lt(
									sharedPlaylistTracks.updatedAt,
									new Date(change.operation_at),
								),
							),
						)
				}

				// 4. reorder（LWW）
				for (const change of reorderChanges) {
					await tx
						.update(sharedPlaylistTracks)
						.set({
							sortKey: change.sort_key,
							updatedAt: new Date(change.operation_at),
						})
						.where(
							and(
								eq(sharedPlaylistTracks.playlistId, playlistId),
								eq(
									sharedPlaylistTracks.trackUniqueKey,
									change.track_unique_key,
								),
								lt(
									sharedPlaylistTracks.updatedAt,
									new Date(change.operation_at),
								),
							),
						)
				}
			})

			const appliedAt = Date.now()
			c.executionCtx.waitUntil(client.end())
			return c.json({ applied_at: appliedAt })
		},
	)
	.get(
		'/:id/changes',
		arktypeValidator('query', getPlaylistChangesRequestSchema),
		async (c) => {
			const { sub } = c.var.jwtPayload
			const mid = sub
			const playlistId = c.req.param('id')
			const sinceMs = c.req.valid('query').since
			const { db, client } = createDb(c.env.DATABASE_URL)

			const member = await getMember(db, playlistId, mid)
			if (!member) {
				return c.json({ error: 'Forbidden' }, 403)
			}

			const sinceDate = new Date(sinceMs)
			const serverTime = Date.now()

			// 元数据变更
			const [playlist] = await db
				.select()
				.from(sharedPlaylists)
				.where(
					and(
						eq(sharedPlaylists.id, playlistId),
						isNull(sharedPlaylists.deletedAt),
					),
				)
			if (!playlist) {
				return c.json({ error: 'Playlist not found' }, 404)
			}
			const metadata =
				playlist.updatedAt > sinceDate
					? {
							title: playlist.title,
							description: playlist.description,
							cover_url: playlist.coverUrl,
							updated_at: playlist.updatedAt.getTime(),
						}
					: null

			// 曲目变化（updatedAt 或 deletedAt > since）
			const changedRows = await db
				.select({
					trackUniqueKey: sharedPlaylistTracks.trackUniqueKey,
					sortKey: sharedPlaylistTracks.sortKey,
					updatedAt: sharedPlaylistTracks.updatedAt,
					deletedAt: sharedPlaylistTracks.deletedAt,
					track: sharedTracks,
				})
				.from(sharedPlaylistTracks)
				.leftJoin(
					sharedTracks,
					eq(sharedPlaylistTracks.trackUniqueKey, sharedTracks.uniqueKey),
				)
				.where(
					and(
						eq(sharedPlaylistTracks.playlistId, playlistId),
						or(
							gt(sharedPlaylistTracks.updatedAt, sinceDate),
							and(
								isNotNull(sharedPlaylistTracks.deletedAt),
								gt(sharedPlaylistTracks.deletedAt, sinceDate),
							),
						),
					),
				)

			const tracks: ChangeEvent[] = changedRows.map((row) => {
				if (row.deletedAt && row.deletedAt > sinceDate) {
					return {
						op: 'delete',
						track_unique_key: row.trackUniqueKey,
						deleted_at: row.deletedAt.getTime(),
					}
				}
				const t = row.track!
				return {
					op: 'upsert',
					track: {
						unique_key: t.uniqueKey,
						title: t.title,
						artist_name: t.artistName ?? undefined,
						artist_id: t.artistId ?? undefined,
						cover_url: t.coverUrl ?? undefined,
						duration: t.duration ?? undefined,
						bilibili_bvid: t.bilibiliBvid,
						bilibili_cid: t.bilibiliCid ?? undefined,
					},
					sort_key: row.sortKey,
					updated_at: row.updatedAt.getTime(),
				}
			})

			// 成员列表（仅 owner + editor）
			const members = await db
				.select({
					mid: playlistMembers.mid,
					role: playlistMembers.role,
					name: users.name,
					avatar_url: users.face,
				})
				.from(playlistMembers)
				.innerJoin(users, eq(users.mid, playlistMembers.mid))
				.where(
					and(
						eq(playlistMembers.playlistId, playlistId),
						or(
							eq(playlistMembers.role, 'owner'),
							eq(playlistMembers.role, 'editor'),
						),
					),
				)

			c.executionCtx.waitUntil(client.end())
			return c.json({
				metadata,
				tracks,
				members: members.map((m) => ({
					...m,
					mid: Number(m.mid),
				})),
				has_more: false,
				server_time: serverTime,
			})
		},
	)
	.post('/:id/subscribe', async (c) => {
		const { sub } = c.var.jwtPayload
		const mid = sub
		const playlistId = c.req.param('id')
		const { db, client } = createDb(c.env.DATABASE_URL)

		// 歌单必须存在且未删除
		const [playlist] = await db
			.select()
			.from(sharedPlaylists)
			.where(
				and(
					eq(sharedPlaylists.id, playlistId),
					isNull(sharedPlaylists.deletedAt),
				),
			)
		if (!playlist) {
			return c.json({ error: 'Playlist not found' }, 404)
		}

		// 如果已经是成员则直接返回现有角色
		const existing = await getMember(db, playlistId, mid)
		if (existing) {
			return c.json({ role: existing.role, already_member: true })
		}

		await db.insert(playlistMembers).values({
			playlistId,
			mid,
			role: 'subscriber',
		})

		c.executionCtx.waitUntil(client.end())
		return c.json({ role: 'subscriber', already_member: false }, 201)
	})
	/**
	 * DELETE /playlists/:id
	 * owner 专用：软删除共享歌单（设置 deletedAt）。
	 * 其他成员若再拉取或订阅此歌单会收到 404。
	 */
	.delete('/:id', async (c) => {
		const { sub } = c.var.jwtPayload
		const mid = sub
		const playlistId = c.req.param('id')
		const { db, client } = createDb(c.env.DATABASE_URL)

		const member = await getMember(db, playlistId, mid)
		if (!member || member.role !== 'owner') {
			return c.json({ error: 'Forbidden' }, 403)
		}

		await db
			.update(sharedPlaylists)
			.set({ deletedAt: new Date() })
			.where(eq(sharedPlaylists.id, playlistId))

		// 清理成员关系，确保后续请求无法再命中
		await db
			.delete(playlistMembers)
			.where(eq(playlistMembers.playlistId, playlistId))

		c.executionCtx.waitUntil(client.end())
		return c.json({ deleted: true })
	})
	/**
	 * DELETE /playlists/:id/members/me
	 * subscriber / editor 专用：从 playlist_members 中移除自己，解除与该歌单的关联。
	 * 幂等：若已不是成员，直接返回成功。
	 * owner 不能调用此接口（应使用 DELETE /playlists/:id）。
	 */
	.delete('/:id/members/me', async (c) => {
		const { sub } = c.var.jwtPayload
		const mid = sub
		const playlistId = c.req.param('id')
		const { db, client } = createDb(c.env.DATABASE_URL)

		const member = await getMember(db, playlistId, mid)
		if (!member) {
			// 已不是成员，幂等返回成功
			return c.json({ removed: true })
		}
		if (member.role === 'owner') {
			return c.json(
				{ error: 'Owner cannot leave; use DELETE /:id to delete the playlist' },
				400,
			)
		}

		await db
			.delete(playlistMembers)
			.where(
				and(
					eq(playlistMembers.playlistId, playlistId),
					eq(playlistMembers.mid, mid),
				),
			)

		c.executionCtx.waitUntil(client.end())
		return c.json({ removed: true })
	})

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
async function getMember(db: DrizzleDb, playlistId: string, mid: string) {
	const [member] = await db
		.select()
		.from(playlistMembers)
		.where(
			and(
				eq(playlistMembers.playlistId, playlistId),
				eq(playlistMembers.mid, mid),
			),
		)
	return member ?? null
}

async function upsertTracks(
	db: DrizzleDb,
	playlistId: string,
	mid: string,
	tracks: Array<{ track: TrackInput; sort_key: string }>,
) {
	await db.transaction(async (tx) => {
		await tx
			.insert(sharedTracks)
			.values(
				tracks.map(({ track }) => ({
					uniqueKey: track.unique_key,
					title: track.title,
					artistName: track.artist_name,
					artistId: track.artist_id,
					coverUrl: track.cover_url,
					duration: track.duration,
					bilibiliBvid: track.bilibili_bvid,
					bilibiliCid: track.bilibili_cid,
				})),
			)
			.onConflictDoNothing()

		await tx
			.insert(sharedPlaylistTracks)
			.values(
				tracks.map(({ track, sort_key }) => ({
					playlistId,
					trackUniqueKey: track.unique_key,
					sortKey: sort_key,
					addedByMid: mid,
				})),
			)
			.onConflictDoNothing()
	})
}

export default playlistsRoute
