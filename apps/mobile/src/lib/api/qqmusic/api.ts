import { decode } from 'he'
import { errAsync, ResultAsync } from 'neverthrow'

import type {
	QQMusicLyricResponse,
	QQMusicPlaylistResponse,
	QQMusicSearchResponse,
} from '@/types/apis/qqmusic'
import type {
	LyricProviderResponseData,
	LyricSearchResult,
} from '@/types/player/lyrics'
import log from '@/utils/log'

const logger = log.extend('API.QQMusic')

export class QQMusicApi {
	/**
	 * Search for songs on QQ Music
	 * @param keyword
	 * @param limit
	 * @returns
	 */
	public search(
		keyword: string,
		limit = 10,
		signal?: AbortSignal,
	): ResultAsync<LyricSearchResult, Error> {
		const searchType = 0 // 0 for song
		const pageNum = 1

		const body = {
			comm: {
				ct: '19',
				cv: '1859',
				uin: '0',
			},
			req: {
				method: 'DoSearchForQQMusicDesktop',
				module: 'music.search.SearchCgiService',
				param: {
					grp: 1,
					num_per_page: limit,
					page_num: pageNum,
					query: keyword,
					search_type: searchType,
				},
			},
		}

		return ResultAsync.fromPromise(
			fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
				method: 'POST',
				body: JSON.stringify(body),
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
					Accept: 'application/json, text/plain, */*',
					'Content-Type': 'application/json;charset=utf-8',
					Referer: 'https://y.qq.com/',
				},
				signal: signal ?? null,
			}).then((res) => {
				if (!res.ok) {
					throw new Error(`QQ Music API error: ${res.statusText}`)
				}
				return res.json() as Promise<QQMusicSearchResponse>
			}),
			(e) => new Error('Failed to search QQ Music', { cause: e }),
		).map((res) => {
			const list = res.req.data.body.song.list
			return list.map((song) => ({
				source: 'qqmusic' as const,
				duration: song.interval,
				title: song.name,
				artist: song.singer[0]?.name ?? 'Unknown',
				remoteId: song.mid,
			}))
		})
	}

	/**
	 * Get lyrics by songmid
	 * @param songmid
	 * @returns
	 */
	public getLyrics(
		songmid: string,
		signal?: AbortSignal,
	): ResultAsync<QQMusicLyricResponse, Error> {
		const url = `https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&nobase64=1`

		return ResultAsync.fromPromise(
			fetch(url, {
				headers: {
					Referer: 'https://y.qq.com/',
				},
				signal: signal ?? null,
			}).then((res) => {
				if (!res.ok) {
					throw new Error(`QQ Music API error: ${res.statusText}`)
				}
				return res.json() as Promise<QQMusicLyricResponse>
			}),
			(e) => new Error('Failed to fetch lyrics from QQ Music', { cause: e }),
		)
	}

	/**
	 * Parse QQ Music lyrics response
	 * @param response
	 * @returns
	 */
	public parseLyrics(
		response: QQMusicLyricResponse,
	): LyricProviderResponseData {
		const rawLyrics = response.lyric ? decode(response.lyric) : undefined
		const transLyrics = response.trans ? decode(response.trans) : undefined

		return {
			lrc: rawLyrics,
			tlyric: transLyrics,
			romalrc: undefined,
		}
	}

	/**
	 * Search and find the best matched lyrics
	 * @param keyword
	 * @param durationMs
	 */
	public searchBestMatchedLyrics(
		keyword: string,
		durationMs: number,
		signal?: AbortSignal,
	): ResultAsync<LyricProviderResponseData, Error> {
		return this.search(keyword, 10, signal).andThen((songs) => {
			if (!songs || songs.length === 0) {
				return errAsync(new Error('No songs found on QQ Music'))
			}

			// Simple matching strategy: prefer exact name match, then duration match
			const targetDurationSeconds = Math.round(durationMs / 1000)

			// Use the first result as default since search relevance is usually good
			let bestMatch = songs[0]

			// Try to find a closer duration match among the top few results
			const MAX_DURATION_DIFF = 3 // seconds
			const candidates = songs.slice(0, 5)

			const exactMatch = candidates.find(
				(s) =>
					Math.abs(s.duration - targetDurationSeconds) <= MAX_DURATION_DIFF,
			)

			if (exactMatch) {
				bestMatch = exactMatch
			} else {
				logger.debug(
					`No exact duration match found. Using first result: ${bestMatch.title} (${bestMatch.duration}s) vs target ${targetDurationSeconds}s`,
				)
			}

			return this.getLyrics(bestMatch.remoteId as string, signal).map(
				(response) => this.parseLyrics(response),
			)
		})
	}

	/**
	 * Get playlist by id
	 * @param id
	 * @returns
	 */
	public getPlaylist(id: string): ResultAsync<QQMusicPlaylistResponse, Error> {
		const params = new URLSearchParams({
			id,
			format: 'json',
			newsong: '1',
			platform: 'jqspaframe.json',
		})

		const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_cp.fcg?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url, {
				headers: {
					Referer: 'http://y.qq.com',
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
				},
			}).then((res) => {
				if (!res.ok) {
					throw new Error(`QQ Music API error: ${res.statusText}`)
				}
				return res.json() as Promise<QQMusicPlaylistResponse>
			}),
			(e) => new Error('Failed to fetch playlist from QQ Music', { cause: e }),
		)
	}
}

export const qqMusicApi = new QQMusicApi()
