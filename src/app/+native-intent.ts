import log from '@/utils/log'
import { getShareExtensionKey } from 'expo-share-intent'

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

		let url: URL | null = null
		try {
			url = new URL(path)
		} catch {
			url = null
		}
		if (url) {
			if (url.hostname === 'notification.click') {
				return '/player'
			}
		}
		return path
	} catch {
		log.error('redirectSystemPath 失败', { path, initial })
		return '/'
	}
}
