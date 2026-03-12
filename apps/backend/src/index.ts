import { Hono } from 'hono'
import { cors } from 'hono/cors'

import authRoute from './routes/auth'
import meRoute from './routes/me'
import playlistsRoute from './routes/playlists'

const healthRoute = new Hono<{ Bindings: Env }>().get('/', (c) =>
	c.json({ status: 'ok', timestamp: Date.now() }),
)

const updateRoute = new Hono<{ Bindings: Env }>().get('/', async (c) => {
	const manifest = await c.env.KV.get('update_json')
	if (!manifest) {
		return c.json({ error: 'Manifest not found' }, 404)
	}
	// manifest 应该是 JSON 字符串，直接返回并设置 content-type
	return c.text(manifest, { headers: { 'Content-Type': 'application/json' } })
})

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
	.route('/update.json', updateRoute)

export default app
export type AppType = typeof app
