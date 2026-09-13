import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { Track } from '@/types/core/media'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

/** 与 Orpheus 拉 B 站音频相同，音箱走本地代理时必须带上 */
const BILIBILI_STREAM_HEADERS = {
	Referer: 'https://www.bilibili.com/',
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export interface ResolvedCastSource {
	title: string
	mime: string
	sourceUrl?: string
	filePath?: string
	headers?: Record<string, string>
}

const guessMime = (path: string) => {
	const ext = path.split('?')[0].split('.').pop()?.toLowerCase()
	switch (ext) {
		case 'mp3':
			return 'audio/mpeg'
		case 'm4a':
		case 'mp4':
			return 'audio/mp4'
		case 'aac':
			return 'audio/aac'
		case 'flac':
			return 'audio/flac'
		case 'wav':
			return 'audio/wav'
		default:
			return 'audio/mp4'
	}
}

export async function resolveCastSource(
	track: Track,
): Promise<ResolvedCastSource> {
	if (track.source === 'local' && track.localMetadata) {
		return {
			title: track.title,
			filePath: track.localMetadata.localPath,
			mime: guessMime(track.localMetadata.localPath),
		}
	}

	if (track.source !== 'bilibili') {
		throw new Error('当前曲目不支持投屏')
	}

	let cid = track.bilibiliMetadata.cid
	if (!cid) {
		const pages = await returnOrThrowAsync(
			bilibiliApi.getPageList({ bvid: track.bilibiliMetadata.bvid }),
		)
		cid = pages[0]?.cid
	}
	if (!cid) {
		throw new Error('无法获取音频 cid')
	}

	const stream = await returnOrThrowAsync(
		bilibiliApi.getAudioStream({
			bvid: track.bilibiliMetadata.bvid,
			cid,
			audioQuality: 30280,
			enableDolby: false,
			enableHiRes: false,
		}),
	)

	const cookie = useAppStore.getState().bilibiliCookie
	const cookieHeader = cookie ? serializeCookieObject(cookie) : undefined

	return {
		title: track.title,
		sourceUrl: stream.url,
		headers: {
			...BILIBILI_STREAM_HEADERS,
			...(cookieHeader ? { Cookie: cookieHeader } : {}),
		},
		mime: stream.type === 'local' ? guessMime(stream.url) : 'audio/mp4',
	}
}
