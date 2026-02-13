import CryptoJS from 'crypto-js'
import { errAsync, ResultAsync } from 'neverthrow'

import type {
	KugouLyricDownloadResponse,
	KugouLyricSearchResponse,
	KugouSearchResponse,
} from '@/types/apis/kugou'
import type {
	LyricProviderResponseData,
	LyricSearchResult,
} from '@/types/player/lyrics'
import log from '@/utils/log'

const logger = log.extend('API.Kugou')

export class KugouApi {
	private getHeaders() {
		return {
			'User-Agent': 'IPhone-8990-searchSong',
			'UNI-UserAgent': 'iOS11.4-Phone8990-1009-0-WiFi',
		}
	}

	search(
		keyword: string,
		limit = 10,
		signal?: AbortSignal,
	): ResultAsync<LyricSearchResult, Error> {
		const params = new URLSearchParams({
			api_ver: '1',
			area_code: '1',
			correct: '1',
			pagesize: limit.toString(),
			plat: '2',
			tag: '1',
			sver: '5',
			showtype: '10',
			page: '1',
			keyword: keyword,
			version: '8990',
		})

		const url = `http://mobilecdn.kugou.com/api/v3/search/song?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url, { headers: this.getHeaders(), signal: signal ?? null }).then(
				(res) => {
					if (!res.ok) {
						throw new Error(`Kugou API error: ${res.statusText}`)
					}
					return res.json() as Promise<KugouSearchResponse>
				},
			),
			(e) => new Error('Failed to search Kugou', { cause: e }),
		).map((res) => {
			if (res.status !== 1 || !res.data?.info) {
				return []
			}
			return res.data.info.map((song) => ({
				source: 'kugou' as const,
				duration: song.duration,
				title: song.songname || song.filename,
				artist: song.singername,
				remoteId: song.hash,
			}))
		})
	}

	getLyrics(id: string, signal?: AbortSignal): ResultAsync<string, Error> {
		// Step 1: Search for lyric candidate
		const searchParams = new URLSearchParams({
			keyword: '%20-%20',
			ver: '1',
			hash: id,
			client: 'mobi',
			man: 'yes',
		})
		const searchUrl = `http://krcs.kugou.com/search?${searchParams.toString()}`

		return ResultAsync.fromPromise(
			fetch(searchUrl, { signal: signal ?? null }).then(
				(res) => res.json() as Promise<KugouLyricSearchResponse>,
			),
			(e) =>
				new Error('Failed to search lyric candidate on Kugou', { cause: e }),
		).andThen((searchRes) => {
			if (!searchRes.candidates || searchRes.candidates.length === 0) {
				return errAsync(new Error('No lyric candidates found on Kugou'))
			}

			const candidate = searchRes.candidates[0]

			// Step 2: Download lyric
			const downloadParams = new URLSearchParams({
				charset: 'utf8',
				accesskey: candidate.accesskey,
				id: candidate.id,
				client: 'mobi',
				fmt: 'lrc',
				ver: '1',
			})
			const downloadUrl = `http://lyrics.kugou.com/download?${downloadParams.toString()}`

			return ResultAsync.fromPromise(
				fetch(downloadUrl, { signal: signal ?? null }).then(
					(res) => res.json() as Promise<KugouLyricDownloadResponse>,
				),
				(e) => new Error('Failed to download lyric from Kugou', { cause: e }),
			).map((downloadRes) => {
				// Decode Base64 content
				const raw = downloadRes.content
				const word = CryptoJS.enc.Base64.parse(raw)
				return CryptoJS.enc.Utf8.stringify(word)
			})
		})
	}

	parseLyrics(content: string): LyricProviderResponseData {
		return {
			lrc: content,
			tlyric: undefined,
			romalrc: undefined,
		}
	}

	searchBestMatchedLyrics(
		keyword: string,
		durationMs: number,
		signal?: AbortSignal,
	): ResultAsync<LyricProviderResponseData, Error> {
		return this.search(keyword, 10, signal).andThen((songs) => {
			if (!songs || songs.length === 0) {
				return errAsync(new Error('No songs found on Kugou'))
			}

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

			return this.getLyrics(bestMatch.remoteId as string, signal).map(
				(content) => this.parseLyrics(content),
			)
		})
	}
}

export const kugouApi = new KugouApi()
