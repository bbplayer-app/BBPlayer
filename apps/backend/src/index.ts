import { Hono } from 'hono'
import { cors } from 'hono/cors'

import authRoute from './routes/auth'
import meRoute from './routes/me'
import playlistsRoute from './routes/playlists'

const healthRoute = new Hono<{ Bindings: Env }>().get('/', (c) =>
	c.json({ status: 'ok', timestamp: Date.now() }),
)

const app = new Hono<{ Bindings: Env }>()
	// .use('*', logger())
	.use(
		'*',
		cors({
			origin: [
				'https://bbplayer.roitium.com',
				'http://localhost:3000',
				'https://bbplayer-backend.roitium.workers.dev',
				'http://localhost:5173',
			],
			allowHeaders: ['Authorization', 'Content-Type'],
			allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		}),
	)
	.route('/auth', authRoute)
	.route('/me', meRoute)
	.route('/health', healthRoute)
	.route('/playlists', playlistsRoute)

export default app
export type AppType = typeof app
