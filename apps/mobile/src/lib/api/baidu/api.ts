import { errAsync, ResultAsync } from 'neverthrow'

import type {
	BaiduLyricResponse,
	BaiduSearchResponse,
} from '@/types/apis/baidu'
import type { LyricSearchResult, ParsedLrc } from '@/types/player/lyrics'
import log from '@/utils/log'
import { parseLrc } from '@/utils/lyrics'

const logger = log.extend('API.Baidu')

export class BaiduApi {
	private getHeaders() {
		// Generate a random 32-char hex string for BAIDUID
		// or just use a fixed one if it works, but better random-ish
		// using simple math random for client side
		const randomHex = Array.from({ length: 32 }, () =>
			Math.floor(Math.random() * 16).toString(16),
		).join('')

		return {
			Cookie: `BAIDUID=${randomHex}:FG=1`,
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) baidu-music/1.2.1 Chrome/66.0.3359.181 Electron/3.0.5 Safari/537.36',
			Accept: '*/*',
			'Content-Type': 'application/json;charset=UTF-8',
			'Accept-Language': 'zh-CN',
		}
	}

	search(keyword: string, limit = 10): ResultAsync<LyricSearchResult, Error> {
		const params = new URLSearchParams({
			from: 'qianqianmini',
			method: 'baidu.ting.search.merge',
			isNew: '1',
			platform: 'darwin',
			page_no: '1',
			query: keyword,
			version: '11.2.1',
			page_size: limit.toString(),
		})

		const url = `http://musicapi.taihe.com/v1/restserver/ting?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url, { headers: this.getHeaders() }).then((res) => {
				if (!res.ok) {
					throw new Error(`Baidu API error: ${res.statusText}`)
				}
				return res.json() as Promise<BaiduSearchResponse>
			}),
			(e) => new Error('Failed to search Baidu', { cause: e }),
		).map((res) => {
			if (
				res.error_code !== 22000 &&
				(res.error_code !== 0 || !res.result?.song_info?.song_list)
			) {
				return []
			}
			return (res.result.song_info.song_list || []).map((song) => ({
				source: 'baidu' as const,
				duration: 0, // Baidu search doesn't return duration in song_list easily usually, assume 0 or need another call
				title: song.title,
				artist: song.author,
				remoteId: song.song_id,
			}))
		})
	}

	getLyrics(id: string): ResultAsync<BaiduLyricResponse, Error> {
		const params = new URLSearchParams({
			from: 'qianqianmini',
			method: 'baidu.ting.song.lry',
			songid: id,
			platform: 'darwin',
			version: '1.0.0',
		})
		const url = `http://musicapi.taihe.com/v1/restserver/ting?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url, { headers: this.getHeaders() }).then((res) => {
				if (!res.ok) {
					throw new Error(`Baidu API error: ${res.statusText}`)
				}
				return res.json() as Promise<BaiduLyricResponse>
			}),
			(e) => new Error('Failed to fetch lyrics from Baidu', { cause: e }),
		)
	}

	parseLyrics(response: BaiduLyricResponse): ParsedLrc {
		return parseLrc(response.lrcContent || '')
	}

	searchBestMatchedLyrics(
		keyword: string,
		_durationMs: number,
		// Baidu search doesn't return duration, so we can't match by duration well.
		// We will rely on keyword match (bestMatch = songs[0])
	): ResultAsync<ParsedLrc, Error> {
		return this.search(keyword).andThen((songs) => {
			if (!songs || songs.length === 0) {
				return errAsync(new Error('No songs found on Baidu'))
			}

			// Since we don't have duration, just use the first result
			const bestMatch = songs[0]
			logger.debug(`Using first result from Baidu: ${bestMatch.title}`)

			return this.getLyrics(bestMatch.remoteId as string).map((res) =>
				this.parseLyrics(res),
			)
		})
	}
}

export const baiduApi = new BaiduApi()
