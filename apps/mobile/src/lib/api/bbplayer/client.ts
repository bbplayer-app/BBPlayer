import type { AppType } from '@bbplayer/backend'
import { hc } from 'hono/client'

import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'

const BASE_URL =
	process.env.EXPO_PUBLIC_BBPLAYER_API_URL ?? 'https://be.bbplayer.roitium.com'

const isAuthLoginRequest = (input: Parameters<typeof fetch>[0]) => {
	const url =
		typeof input === 'string'
			? input
			: input instanceof URL
				? input.href
				: input.url
	return url.endsWith('/auth/login')
}

/** 若当前无 BBPlayer JWT，尝试用 Bilibili Cookie 自动换取。无 cookie 时抛出异常。 */
export async function ensureBBPlayerToken(options?: {
	forceRefresh?: boolean
}): Promise<void> {
	const store = useAppStore.getState()
	if (!options?.forceRefresh && store.bbplayerToken) return

	if (options?.forceRefresh) {
		store.clearBbplayerToken()
	}

	const cookie = store.bilibiliCookie
	if (!cookie || Object.keys(cookie).length === 0) {
		throw new Error('请先登录 Bilibili，才能使用共享功能')
	}

	const cookieStr = serializeCookieObject(cookie)
	const resp = await api.auth.login.$post({
		json: { cookie: cookieStr },
	})
	if (!resp.ok) {
		const body = await resp.json().catch(() => ({}))
		throw new Error(
			`BBPlayer 身份验证失败（${resp.status}）：${JSON.stringify(body)}`,
		)
	}
	const data = (await resp.json()) as { token: string }
	store.setBbplayerToken(data.token)
}

const fetchWithAuthRetry: typeof fetch = async (input, init) => {
	const response = await fetch(input, init)
	if (response.status !== 401 || isAuthLoginRequest(input)) {
		return response
	}

	await ensureBBPlayerToken({ forceRefresh: true })
	const token = useAppStore.getState().bbplayerToken
	if (!token) return response

	const headers = new Headers(init?.headers)
	headers.set('Authorization', `Bearer ${token}`)
	return fetch(input, { ...init, headers })
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
