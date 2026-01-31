import { errAsync, ResultAsync } from 'neverthrow'

import type { KuwoLyricResponse, KuwoSearchResponse } from '@/types/apis/kuwo'
import type { LyricSearchResult, ParsedLrc } from '@/types/player/lyrics'
import log from '@/utils/log'
import { parseLrc } from '@/utils/lyrics'

const logger = log.extend('API.Kuwo')

export class KuwoApi {
	private getHeaders() {
		return {
			Cookie: 'kw_token=3E7JFQ7MRPL',
			csrf: '3E7JFQ7MRPL',
			Host: 'www.kuwo.cn',
			Referer: 'http://www.kuwo.cn/',
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
		}
	}

	search(keyword: string, limit = 10): ResultAsync<LyricSearchResult, Error> {
		const params = new URLSearchParams({
			key: keyword,
			pn: '1',
			rn: limit.toString(),
			httpsStatus: '1',
		})

		const url = `http://www.kuwo.cn/api/www/search/searchMusicBykeyWord?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url, { headers: this.getHeaders() }).then((res) => {
				if (!res.ok) {
					throw new Error(`Kuwo API error: ${res.statusText}`)
				}
				return res.json() as Promise<KuwoSearchResponse>
			}),
			(e) => new Error('Failed to search Kuwo', { cause: e }),
		).map((res) => {
			if (res.code !== 200 || !res.data?.list) {
				return []
			}
			return res.data.list.map((song) => ({
				source: 'kuwo' as const,
				duration: song.duration,
				title: song.name,
				artist: song.artist,
				remoteId: song.rid,
			}))
		})
	}

	getLyrics(id: number | string): ResultAsync<KuwoLyricResponse, Error> {
		const params = new URLSearchParams({
			musicId: id.toString(),
			httpsStatus: '1',
		})
		const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url).then((res) => {
				if (!res.ok) {
					throw new Error(`Kuwo API error: ${res.statusText}`)
				}
				return res.json() as Promise<KuwoLyricResponse>
			}),
			(e) => new Error('Failed to fetch lyrics from Kuwo', { cause: e }),
		)
	}

	parseLyrics(response: KuwoLyricResponse): ParsedLrc {
		const lrcList = response.data?.lrclist
		if (!lrcList || lrcList.length === 0) {
			return {
				lyrics: [],
				rawOriginalLyrics: '',
				tags: {},
				offset: 0,
			}
		}

		let rawLrc = ''
		lrcList.forEach((item) => {
			const time = parseFloat(item.time)
			const minutes = Math.floor(time / 60)
			const seconds = Math.floor(time % 60)
			const milliseconds = Math.floor((time % 1) * 100)

			const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
			rawLrc += `${timeStr}${item.lineLyric}\n`
		})

		const parsed = parseLrc(rawLrc)
		return parsed
	}

	searchBestMatchedLyrics(
		keyword: string,
		durationMs: number,
	): ResultAsync<ParsedLrc, Error> {
		return this.search(keyword).andThen((songs) => {
			if (!songs || songs.length === 0) {
				return errAsync(new Error('No songs found on Kuwo'))
			}

			// Duration matching logic similar to QQ Music
			const targetDurationSeconds = Math.round(durationMs / 1000)
			let bestMatch = songs[0]
			const MAX_DURATION_DIFF = 3
			const candidates = songs.slice(0, 5)

			const exactMatch = candidates.find(
				(s) =>
					Math.abs(s.duration - targetDurationSeconds) <= MAX_DURATION_DIFF,
			)

			if (exactMatch) {
				bestMatch = exactMatch
			} else {
				logger.debug(
					`No exact duration match found. Using first result: ${bestMatch.title}`,
				)
			}

			return this.getLyrics(bestMatch.remoteId as number).map((res) =>
				this.parseLyrics(res),
			)
		})
	}
}

export const kuwoApi = new KuwoApi()
