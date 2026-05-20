import type { AppType } from '@bbplayer/backend'
import { hc } from 'hono/client'

import useAppStore from '@/hooks/stores/useAppStore'

const BASE_URL =
	process.env.EXPO_PUBLIC_BBPLAYER_API_URL ?? 'https://be.bbplayer.roitium.com'

const isAuthLoginRequest = (input: Parameters<typeof fetch>[0]) => {
	const url =
		typeof input === 'string'
			? input
			: input instanceof URL
				? input.href
				: input.url
	return (
		url.endsWith('/auth/login') ||
		url.endsWith('/auth/register') ||
		url.endsWith('/auth/me')
	)
}

export async function ensureBBPlayerToken(options?: {
	forceRefresh?: boolean
}): Promise<void> {
	const store = useAppStore.getState()
	if (!options?.forceRefresh && store.bbplayerToken) return

	throw new Error('请先登录 BBPlayer 账号，才能使用共享功能')
}

const fetchWithAuthRetry: typeof fetch = async (input, init) => {
	const response = await fetch(input, init)
	if (response.status !== 401 || isAuthLoginRequest(input)) {
		return response
	}

	useAppStore.getState().clearBBPlayerAccount()
	return response
}

export const api = hc<AppType>(BASE_URL, {
	headers: () => {
		const token = useAppStore.getState().bbplayerToken
		const headers: Record<string, string> = {}
		if (token) headers['Authorization'] = `Bearer ${token}`
		return headers
	},
	fetch: fetchWithAuthRetry,
})
