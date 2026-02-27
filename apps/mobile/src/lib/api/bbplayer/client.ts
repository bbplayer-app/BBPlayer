import type { AppType } from '@bbplayer/backend'
import { hc } from 'hono/client'

import useAppStore from '@/hooks/stores/useAppStore'

const BASE_URL =
	process.env.EXPO_PUBLIC_BBPLAYER_API_URL ?? 'https://be.bbplayer.roitium.com'

export const api = hc<AppType>(BASE_URL, {
	headers: () => {
		const token = useAppStore.getState().bbplayerToken
		const headers: Record<string, string> = {}
		if (token) headers['Authorization'] = `Bearer ${token}`
		return headers
	},
})
