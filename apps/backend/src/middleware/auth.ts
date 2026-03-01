import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'

import type { JwtTokenPayload } from '../types'

/**
 * JWT 鉴权中间件。
 * 校验通过后将 payload 注入 `c.var.jwtPayload`，
 * 路由层通过 `c.var.jwtPayload` 读取 mid 及 jwtVersion。
 */
export const authMiddleware = createMiddleware<{
	Bindings: Env
	Variables: { jwtPayload: JwtTokenPayload }
}>(async (c, next) => {
	const authHeader = c.req.header('Authorization')
	if (!authHeader?.startsWith('Bearer ')) {
		return c.json({ error: 'Unauthorized' }, 401)
	}
	const token = authHeader.slice(7)
	try {
		const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
		if (typeof payload.sub !== 'string') {
			return c.json({ error: 'Invalid token payload' }, 401)
		}
		c.set('jwtPayload', payload as unknown as JwtTokenPayload)
	} catch {
		return c.json({ error: 'Invalid or expired token' }, 401)
	}
	await next()
})
