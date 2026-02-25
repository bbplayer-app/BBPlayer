import type { AppType } from '@bbplayer/backend'
import { hc } from 'hono/client'

import { getAuthToken } from './token'

// const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://be.bbplayer.app'

const BASE_URL = '10.0.2.2:8787'

export const api = hc<AppType>(BASE_URL, {
	headers: () => {
		const token = getAuthToken()
		const headers: Record<string, string> = {}
		if (token) headers['Authorization'] = `Bearer ${token}`
		return headers
	},
})
