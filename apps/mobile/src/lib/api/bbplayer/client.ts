/**
 * BBPlayer 后端 API 类型安全客户端
 *
 * 基于 Hono `hc`：纯 fetch Proxy，无 Node.js 依赖，React Native 可用。
 * AppType 仅在编译期使用，不进入 RN bundle。
 *
 * 用法示例：
 *   const res = await api.api.auth.login.$post({ json: { cookie } })
 *   const { token } = await res.json()
 *
 *   const res = await api.api.playlists.$post({ json: { title: '我的歌单' } })
 */
import type { AppType } from '@bbplayer/backend'
import { hc } from 'hono/client'

import { getAuthToken } from './token'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://be.bbplayer.app'

export const api = hc<AppType>(BASE_URL, {
	headers: () => {
		const token = getAuthToken()
		const headers: Record<string, string> = {}
		if (token) headers['Authorization'] = `Bearer ${token}`
		return headers
	},
})
