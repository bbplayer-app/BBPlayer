import { Orpheus, type BilibiliCdnPreference } from '@bbplayer/orpheus'
import { fetch } from 'react-native-nitro-fetch'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { BILIBILI_WEB_USER_AGENT } from '@/lib/api/bilibili/client'
import type { BilibiliTrack } from '@/types/core/media'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const BILIBILI_CDN_OPTIONS: {
	id: BilibiliCdnPreference
	label: string
}[] = [
	{ id: 'auto', label: '自动（常规 CDN 优先）' },
	{ id: 'ali', label: '阿里云' },
	{ id: 'tencent', label: '腾讯云' },
	{ id: 'huawei', label: '华为云' },
	{ id: 'akamai', label: 'Akamai' },
]

export interface BilibiliCdnNode {
	host: string
	url: string
	provider: BilibiliCdnPreference
}

export interface CdnSpeedResult {
	megabytesPerSecond: number
	latencyMs: number
}

export function setPreferredBilibiliCdn(preference: BilibiliCdnPreference) {
	Orpheus.preferredBilibiliCdn = preference
}

const SAMPLE_BVID = 'BV1fK4y1t7hj'
const SAMPLE_CID = 196018899
const SAMPLE_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 8000

function providerForHost(host: string): BilibiliCdnPreference {
	if (host === 'upos-hz-mirrorakam.akamaized.net') return 'akamai'
	if (!host.endsWith('.bilivideo.com')) return 'auto'
	if (host.startsWith('upos-sz-mirrorali')) return 'ali'
	if (
		host.startsWith('upos-sz-mirrorcos') ||
		host === 'upos-tf-all-tx.bilivideo.com'
	)
		return 'tencent'
	if (
		host.startsWith('upos-sz-mirrorhw') ||
		host.startsWith('upos-sz-mirror08') ||
		host === 'upos-tf-all-hw.bilivideo.com'
	)
		return 'huawei'
	return 'auto'
}

export async function getCdnTestNodes(
	track: BilibiliTrack | null,
	signal: AbortSignal,
): Promise<BilibiliCdnNode[]> {
	const bvid = track?.bilibiliMetadata.bvid ?? SAMPLE_BVID
	let cid = track ? track.bilibiliMetadata.cid : SAMPLE_CID
	if (!cid) {
		const details = await returnOrThrowAsync(
			bilibiliApi.getVideoDetails({ bvid, signal }),
		)
		cid = details.cid
	}
	const data = await returnOrThrowAsync(
		bilibiliApi.getAudioStreamInfo({
			bvid,
			cid,
			signal,
		}),
	)
	const audio =
		data.dash?.audio?.find((item) => item.id === 30280) ?? data.dash?.audio?.[0]
	const urls = audio
		? [
				audio.baseUrl || audio.base_url,
				...(audio.backupUrl ?? audio.backup_url ?? []),
			]
		: [data.durl?.[0]?.url, ...(data.durl?.[0]?.backup_url ?? [])]
	const nodes = new Map<string, BilibiliCdnNode>()
	for (const url of urls) {
		if (!url) continue
		const parsed = new URL(url)
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
		if (!nodes.has(parsed.hostname)) {
			nodes.set(parsed.hostname, {
				host: parsed.hostname,
				url,
				provider: providerForHost(parsed.hostname),
			})
		}
	}
	if (!nodes.size) throw new Error('未获取到可测速的音频地址')
	return [...nodes.values()]
}

/** Download a bounded audio sample through the streaming transport, bypassing local caches. */
export async function measureCdnSpeed(
	url: string,
	signal: AbortSignal,
): Promise<CdnSpeedResult> {
	if (signal.aborted) throw new Error('测速已取消')
	const controller = new AbortController()
	const onAbort = () => controller.abort()
	signal.addEventListener('abort', onAbort, { once: true })
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
	try {
		const started = performance.now()
		const response = await fetch(url, {
			stream: true,
			cache: 'no-store',
			credentials: 'omit',
			signal: controller.signal,
			headers: {
				'User-Agent': BILIBILI_WEB_USER_AGENT,
				Referer: 'https://www.bilibili.com/',
				Range: `bytes=0-${SAMPLE_BYTES - 1}`,
				'Cache-Control': 'no-cache',
			},
		})
		const latencyMs = performance.now() - started
		if (response.status !== 200 && response.status !== 206) {
			throw new Error(`HTTP ${response.status}`)
		}
		if (/text\/|json/i.test(response.headers.get('content-type') ?? '')) {
			throw new Error('节点未返回音频数据')
		}
		reader = response.body?.getReader()
		if (!reader) throw new Error('无法读取测速数据')
		let received = 0
		while (received < SAMPLE_BYTES) {
			const { done, value } = await reader.read()
			if (done) break
			received += value.byteLength
		}
		if (controller.signal.aborted) throw new Error('测速已中断')
		if (!received) throw new Error('节点返回空数据')
		return {
			megabytesPerSecond:
				received /
				(1024 * 1024) /
				Math.max((performance.now() - started) / 1000, 0.001),
			latencyMs,
		}
	} catch (error) {
		if (signal.aborted) throw new Error('测速已取消', { cause: error })
		if (controller.signal.aborted)
			throw new Error('测速超时（8 秒）', { cause: error })
		throw error
	} finally {
		clearTimeout(timeout)
		signal.removeEventListener('abort', onAbort)
		controller.abort()
		try {
			await reader?.cancel()
		} catch {
			// An aborted transport may already have closed its reader.
		}
	}
}
