import { type } from 'arktype'
import CryptoJS from 'crypto-js'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { KugouApiError } from '@/lib/errors/thirdparty/kugou'
import {
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
	): ResultAsync<LyricSearchResult, KugouApiError> {
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
			fetch(url, { headers: this.getHeaders(), signal }).then((res) => {
				if (!res.ok) {
					throw new Error(`Kugou API error: ${res.statusText}`)
				}
				return res.json() as Promise<unknown>
			}),
			(e) =>
				new KugouApiError({
					message: 'Failed to search Kugou',
					type: 'RequestFailed',
					cause: e,
				}),
		).andThen((raw) => {
			const validated = KugouSearchResponse(raw)
			if (validated instanceof type.errors) {
				return errAsync(
					new KugouApiError({
						message: `Kugou search response validation failed: ${validated.summary}`,
						type: 'ValidationFailed',
						rawData: raw,
						cause: validated,
					}),
				)
			}
			const res = validated
			if (res.status !== 1 || !res.data?.info) {
				return okAsync<LyricSearchResult, KugouApiError>([])
			}
			return okAsync(
				res.data.info.map((song) => ({
					source: 'kugou' as const,
					duration: song.duration,
					title: song.songname || song.filename,
					artist: song.singername,
					remoteId: song.hash,
				})),
			)
		})
	}

	getLyrics(
		id: string,
		signal?: AbortSignal,
	): ResultAsync<string, KugouApiError> {
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
			fetch(searchUrl, { signal }).then(
				(res) => res.json() as Promise<unknown>,
			),
			(e) =>
				new KugouApiError({
					message: 'Failed to search lyric candidate on Kugou',
					type: 'RequestFailed',
					cause: e,
				}),
		).andThen((raw) => {
			const searchRes = KugouLyricSearchResponse(raw)
			if (searchRes instanceof type.errors) {
				return errAsync(
					new KugouApiError({
						message: `Kugou lyric search validation failed: ${searchRes.summary}`,
						type: 'ValidationFailed',
						rawData: raw,
						cause: searchRes,
					}),
				)
			}

			if (!searchRes.candidates || searchRes.candidates.length === 0) {
				return errAsync(
					new KugouApiError({
						message: 'No lyric candidates found on Kugou',
						type: 'ResponseFailed',
					}),
				)
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
				fetch(downloadUrl, { signal }).then(
					(res) => res.json() as Promise<unknown>,
				),
				(e) =>
					new KugouApiError({
						message: 'Failed to download lyric from Kugou',
						type: 'RequestFailed',
						cause: e,
					}),
			).andThen((downloadRaw) => {
				const downloadRes = KugouLyricDownloadResponse(downloadRaw)
				if (downloadRes instanceof type.errors) {
					return errAsync(
						new KugouApiError({
							message: `Kugou lyric download validation failed: ${downloadRes.summary}`,
							type: 'ValidationFailed',
							rawData: downloadRaw,
							cause: downloadRes,
						}),
					)
				}
				// Decode Base64 content
				const raw = downloadRes.content
				const word = CryptoJS.enc.Base64.parse(raw)
				return okAsync(CryptoJS.enc.Utf8.stringify(word))
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
	): ResultAsync<LyricProviderResponseData, KugouApiError> {
		return this.search(keyword, 10, signal).andThen((songs) => {
			if (!songs || songs.length === 0) {
				return errAsync(
					new KugouApiError({
						message: 'No songs found on Kugou',
						type: 'ResponseFailed',
					}),
				)
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
