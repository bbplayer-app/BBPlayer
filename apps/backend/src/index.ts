import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import authRoute from './routes/auth'
import meRoute from './routes/me'
import playlistsRoute from './routes/playlists'

const app = new Hono<{ Bindings: Env }>()

// ---------------------------------------------------------------------------
// 全局中间件
// ---------------------------------------------------------------------------
app.use('*', logger())
app.use(
	'*',
	cors({
		origin: ['https://bbplayer.app', 'http://localhost:3000'],
		allowHeaders: ['Authorization', 'Content-Type'],
		allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
	}),
)

app.route('/api/auth', authRoute)
app.route('/api/me', meRoute)
app.route('/api/playlists', playlistsRoute)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

export default app
export type AppType = typeof app
