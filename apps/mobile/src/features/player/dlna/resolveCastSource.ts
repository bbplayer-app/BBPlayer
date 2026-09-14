import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { Track } from '@/types/core/media'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import { getInternalPlayUri } from '@/utils/player'

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

	let resolved = track
	if (track.bilibiliMetadata.isMultiPage && !track.bilibiliMetadata.cid) {
		const pages = await returnOrThrowAsync(
			bilibiliApi.getPageList({ bvid: track.bilibiliMetadata.bvid }),
		)
		const cid = pages[0]?.cid
		if (!cid) throw new Error('无法获取音频 cid')
		resolved = {
			...track,
			bilibiliMetadata: { ...track.bilibiliMetadata, cid },
		}
	}

	const sourceUrl = getInternalPlayUri(resolved)
	if (!sourceUrl) throw new Error('无法获取音频地址')

	return {
		title: track.title,
		sourceUrl,
		mime: 'audio/mp4',
	}
}
