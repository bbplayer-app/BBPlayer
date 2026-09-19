import { createURL } from 'expo-linking'

import log from '@/utils/log'
import { getStartupScreen } from '@/utils/startup-screen'

function resolveStartupPath(path: string, initial: boolean) {
	// 在创建初始导航状态前选择启动页，仅处理根入口，保留深链和运行中的跳转。
	const root = path.match(/^\/(?:\(tabs\)\/?)?(?=[?#]|$)/)
	if (initial && root && getStartupScreen() === 'library') {
		return `/library/0${path.slice(root[0].length)}`
	}
	return path
}

export function redirectSystemPath({
	path,
	initial,
}: {
	path: string
	initial: boolean
}) {
	try {
		// 这里的 path 可能是一个完整的 URL，也可能是一个 path
		let url: URL | null = null
		try {
			url = new URL(path)
		} catch {
			// ignore
		}
		if (url) {
			if (initial) {
				// 与 Expo Router 的默认启动 URL 使用同一来源，兼容开发包的 hostUri。
				const rootURL = new URL(createURL('/'))
				if (
					url.protocol === rootURL.protocol &&
					url.host === rootURL.host &&
					url.pathname.replace(/\/$/, '') ===
						rootURL.pathname.replace(/\/$/, '')
				) {
					return resolveStartupPath(`/${url.search}${url.hash}`, initial)
				}
			}
			if (url.hostname === 'expo-sharing') {
				return '/(tabs)'
			}
			if (url.hostname === 'notification.click') {
				return '/player'
			}
			if (url.hostname === 'bbplayer.roitium.com') {
				const result = url.href.split('/link-to/')[1]
				if (result) {
					return result
				}
			}
			if (url.hostname === 'app.bbplayer.roitium.com') {
				const result = url.href.split('/link-to/')[1]
				if (result) {
					return result
				}
			}
			if (url.protocol === 'bbplayer:') {
				const pathname = `/${url.hostname}${url.pathname}`.replace(/^\/+/, '/')
				return resolveStartupPath(
					`${pathname}${url.search}${url.hash}`,
					initial,
				)
			}
		}
		return resolveStartupPath(path, initial)
	} catch {
		log.error('redirectSystemPath 失败', { path, initial })
		return '/'
	}
}
