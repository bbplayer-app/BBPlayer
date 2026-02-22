import { Orpheus } from '@bbplayer/orpheus'
import { Platform } from 'react-native'

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
