import { arktypeValidator } from '@hono/arktype-validator'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'

import { createDb } from '../db'
import { users } from '../db/schema'
import { loginRequestSchema } from '../validators/auth'

/**
 * POST /api/auth/login
 * Body: { cookie: string }  — 客户端传入 B 站 SESSDATA cookie
 *
 * 流程：
 *  1. 用 cookie 请求 B 站 nav API 验证身份
 *  2. upsert users 表
 *  3. 签发 JWT（sub=mid, jwtVersion=当前值）
 */
const authRoute = new Hono<{ Bindings: Env }>()

authRoute.post(
	'/login',
	arktypeValidator('json', loginRequestSchema, (result, c) => {
		if (!result.success) {
			return c.json(
				{ error: 'invalid_body', summary: result.errors.summary },
				400,
			)
		}
	}),
	async (c) => {
		const { cookie } = c.req.valid('json')

		// -----------------------------------------------------------------------
		// 1. 向 B 站验证 cookie
		// -----------------------------------------------------------------------
		const biliRes = await fetch(
			'https://api.bilibili.com/x/web-interface/nav',
			{
				headers: { Cookie: cookie },
			},
		)
		const biliJson = await biliRes.json()

		if (biliJson.code !== 0 || !biliJson.data?.isLogin) {
			return c.json({ error: 'Invalid Bilibili cookie' }, 401)
		}

		const { mid, uname, face } = biliJson.data

		// -----------------------------------------------------------------------
		// 2. Upsert user
		// -----------------------------------------------------------------------
		const { db, client } = createDb(c.env.DATABASE_URL)

		await db
			.insert(users)
			.values({
				mid: String(mid),
				name: uname,
				face,
			})
			.onConflictDoUpdate({
				target: users.mid,
				set: {
					name: uname,
					face,
					lastLoginAt: new Date(),
				},
			})
			.returning()

		// -----------------------------------------------------------------------
		// 3. 签发 JWT
		// -----------------------------------------------------------------------
		const now = Math.floor(Date.now() / 1000)
		const token = await sign(
			{
				sub: String(mid),
				iat: now,
				exp: undefined,
			},
			c.env.JWT_SECRET,
		)

		c.executionCtx.waitUntil(client.end())
		return c.json({ token, mid, name: uname, face })
	},
)

export default authRoute
