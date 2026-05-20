import { arktypeValidator } from '@hono/arktype-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'

import { createDb } from '../db'
import { users } from '../db/schema'
import { loginRequestSchema } from '../validators/auth'

const BILIBILI_NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'
const BILIBILI_WEB_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

type BilibiliNavResponse = {
	code: number
	message?: string
	data?: {
		isLogin: boolean
		mid: number
		uname: string
		face: string
	}
}

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

		let biliRes: Response
		try {
			biliRes = await fetch(BILIBILI_NAV_URL, {
				headers: {
					Accept: 'application/json, text/plain, */*',
					Cookie: cookie,
					Referer: 'https://www.bilibili.com/',
					'User-Agent': BILIBILI_WEB_USER_AGENT,
				},
				signal: controller.signal,
			})
		} catch (error) {
			const status =
				error instanceof Error && error.name === 'AbortError' ? 504 : 502
			return c.json(
				{
					error: 'Bilibili verification failed',
					message: error instanceof Error ? error.message : String(error),
				},
				status,
			)
		} finally {
			clearTimeout(timeoutId)
		}

		const biliText = await biliRes.text()
		let biliJson: BilibiliNavResponse
		try {
			biliJson = JSON.parse(biliText) as BilibiliNavResponse
		} catch {
			return c.json(
				{
					error: 'Bilibili verification failed',
					message: 'Bilibili returned a non-JSON response',
					upstreamContentType: biliRes.headers.get('content-type'),
					upstreamStatus: biliRes.status,
				},
				502,
			)
		}

		if (biliJson.code !== 0 || !biliJson.data?.isLogin) {
			return c.json(
				{ error: 'Invalid Bilibili cookie', rawResponse: biliJson },
				401,
			)
		}

		const { mid, uname, face } = biliJson.data

		const { db, client } = await createDb(c.env.DATABASE_URL)
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
				},
				c.env.JWT_SECRET,
			)

			return c.json({ token, mid: String(mid), name: uname, face })
		} catch {
			return c.json({ error: 'Internal server error' }, 500)
		} finally {
			await client.end()
		}
	},
)

export default authRoute
