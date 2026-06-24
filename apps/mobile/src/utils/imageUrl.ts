import { Orpheus } from '@bbplayer/orpheus'
import { Platform } from 'react-native'

const BILIBILI_IMAGE_CDN = /^https?:\/\/i[0-2]\.hdslb\.com\/bfs\//

/**
 * 利用 b 站的 cdn 参数，缩放图片，避免因为尺寸过大导致 Glide（expo-image）报错
 */
export function resolveBilibiliImageUrl(
	url: string | null | undefined,
	maxSize = 800,
): string | null | undefined {
	if (!url) return url
	const secureUrl = url.startsWith('http:')
		? url.replace('http:', 'https:')
		: url
	if (!BILIBILI_IMAGE_CDN.test(secureUrl)) return secureUrl
	if (secureUrl.includes('@')) return secureUrl
	return `${secureUrl}@${maxSize}w_${maxSize}h`
}

/**
 * 尝试获取本地已下载的封面 URI，如果不存在则返回原始 coverUrl。
 * 仅在 Android 上生效（iOS 暂不支持下载）。
 */
export function resolveTrackCover(
	uniqueKey: string | undefined,
	remoteCoverUrl: string | null | undefined,
): string | null | undefined {
	if (Platform.OS !== 'android' || !uniqueKey) return remoteCoverUrl
	return Orpheus.getDownloadedCoverUri(uniqueKey) ?? remoteCoverUrl
}
