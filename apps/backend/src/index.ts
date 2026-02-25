import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import authRoute from './routes/auth'
import meRoute from './routes/me'
import playlistsRoute from './routes/playlists'

const healthRoute = new Hono<{ Bindings: Env }>().get('/', (c) =>
	c.json({ status: 'ok', timestamp: Date.now() }),
)

const app = new Hono<{ Bindings: Env }>()
	.use('*', logger())
	.use(
		'*',
		cors({
			origin: ['https://bbplayer.app', 'http://localhost:3000'],
			allowHeaders: ['Authorization', 'Content-Type'],
			allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
		}),
	)
	.route('/auth', authRoute)
	.route('/me', meRoute)
	.route('/health', healthRoute)
	.route('/playlists', playlistsRoute)

export default app
export type AppType = typeof app
