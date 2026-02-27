import { getShareExtensionKey } from 'expo-share-intent'

import log from '@/utils/log'

export function redirectSystemPath({
	path,
	initial,
}: {
	path: string
	initial: boolean
}) {
	try {
		const shareKey = getShareExtensionKey?.()
		if (shareKey && path.includes(`dataUrl=${shareKey}`)) {
			return '/(tabs)/index'
		}

		// 这里的 path 可能是一个完整的 URL，也可能是一个 path
		let url: URL | null = null
		try {
			url = new URL(path)
		} catch {
			// ignore
		}
		if (url) {
			if (url.protocol === 'bbplayer:') {
				return `/${url.hostname}${url.pathname}${url.search}`
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
		}
		return path
	} catch {
		log.error('redirectSystemPath 失败', { path, initial })
		return '/'
	}
}
