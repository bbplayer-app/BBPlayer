import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'

import { createDb } from '../db'
import { playlistMembers, sharedPlaylists } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { JwtTokenPayload } from '../types'

/**
 * GET /api/me/playlists
 * 返回当前用户参与（owner / editor / subscriber）的所有未删除歌单。
 * 用于换设备后的全量恢复入口。
 */
const meRoute = new Hono<{
	Bindings: Env
	Variables: { jwtPayload: JwtTokenPayload }
}>()
	.use('*', authMiddleware)
	.get('/playlists', async (c) => {
		const { sub } = c.var.jwtPayload
		const { db, client } = createDb(c.env.DATABASE_URL)

		const rows = await db
			.select({
				id: sharedPlaylists.id,
				title: sharedPlaylists.title,
				description: sharedPlaylists.description,
				coverUrl: sharedPlaylists.coverUrl,
				updatedAt: sharedPlaylists.updatedAt,
				role: playlistMembers.role,
				joinedAt: playlistMembers.joinedAt,
			})
			.from(playlistMembers)
			.innerJoin(
				sharedPlaylists,
				and(
					eq(playlistMembers.playlistId, sharedPlaylists.id),
					isNull(sharedPlaylists.deletedAt),
				),
			)
			.where(eq(playlistMembers.mid, sub))

		c.executionCtx.waitUntil(client.end())
		return c.json({ playlists: rows })
	})

export default meRoute
