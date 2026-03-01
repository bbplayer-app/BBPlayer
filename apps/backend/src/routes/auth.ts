import { arktypeValidator } from '@hono/arktype-validator'
import { eq } from 'drizzle-orm'
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
const authRoute = new Hono<{ Bindings: Env }>().post(
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
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

		const biliRes = await fetch(
			'https://api.bilibili.com/x/web-interface/nav',
			{
				headers: { Cookie: cookie },
				signal: controller.signal,
			},
		).finally(() => clearTimeout(timeoutId))
		const biliJson = (await biliRes.json()) as {
			code: number
			message?: string
			data?: {
				isLogin: boolean
				mid: number
				uname: string
				face: string
			}
		}

		if (biliJson.code !== 0 || !biliJson.data?.isLogin) {
			return c.json({ error: 'Invalid Bilibili cookie' }, 401)
		}

		const { mid, uname, face } = biliJson.data

		const { db } = await createDb(c.env.DATABASE_URL)
		try {
			const existing = await db
				.select({ mid: users.mid })
				.from(users)
				.where(eq(users.mid, String(mid)))
				.limit(1)

			if (existing.length === 0) {
				await db.insert(users).values({
					mid: String(mid),
					name: uname,
					face,
					lastLoginAt: new Date(),
				})
			} else {
				await db
					.update(users)
					.set({
						name: uname,
						face,
						lastLoginAt: new Date(),
					})
					.where(eq(users.mid, String(mid)))
			}

			// Generate JWT
			const token = await sign(
				{
					sub: String(mid),
					role: 'user',
					exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
				},
				c.env.JWT_SECRET,
			)

			return c.json({ token, mid: String(mid), name: uname, face })
		} catch {
			return c.json({ error: 'Internal server error' }, 500)
		}
	},
)

export default authRoute
