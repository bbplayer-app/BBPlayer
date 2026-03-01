import log from '@/utils/log'

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
				return `/${url.hostname}${url.pathname}${url.search}`
			}
		}
		return path
	} catch {
		log.error('redirectSystemPath 失败', { path, initial })
		return '/'
	}
}
