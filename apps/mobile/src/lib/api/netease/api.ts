import { parseYrc } from '@bbplayer/splash/src/converter/netease'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

import { NeteaseApiError } from '@/lib/errors/thirdparty/netease'
import type {
	NeteaseLyricResponse,
	NeteasePlaylistResponse,
	NeteaseSearchResponse,
} from '@/types/apis/netease'
import type {
	LyricProviderResponseData,
	LyricSearchResult,
} from '@/types/player/lyrics'

import type { RequestOptions } from './request'
import { createRequest } from './request'
import { createOption } from './utils'

interface SearchParams {
	keywords: string
	type?: number | string
	limit?: number
	offset?: number
}

export class NeteaseApi {
	getLyrics(
		id: number,
		signal?: AbortSignal,
	): ResultAsync<NeteaseLyricResponse, NeteaseApiError> {
		const data = {
			id: id,
			lv: -1,
			tv: -1,
			rv: -1,
			kv: -1,
			yv: -1,
			os: 'ios',
			ver: 1,
		}
		const requestOptions: RequestOptions = createOption(
			{
				crypto: 'eapi',
				cookie: {
					os: 'ios',
					appver: '8.7.01',
					osver: '16.3',
					deviceId: '265B59C3-C5DE-4876-8A33-FD52CD5C2960',
				},
			},
			'eapi',
		)
		if (signal) {
			requestOptions.signal = signal
		}
		return createRequest<object, NeteaseLyricResponse>(
			'/api/song/lyric/v1',
			data,
			requestOptions,
		).map((res) => res.body)
	}

	search(
		params: SearchParams,
		signal?: AbortSignal,
	): ResultAsync<LyricSearchResult, NeteaseApiError> {
		const type = params.type ?? 1
		const endpoint =
			type == '2000' ? '/api/search/voice/get' : '/api/cloudsearch/pc'

		const data = {
			type: type,
			limit: params.limit ?? 30,
			offset: params.offset ?? 0,
			...(type == '2000'
				? { keyword: params.keywords }
				: { s: params.keywords }),
		}

		const requestOptions: RequestOptions = createOption({}, 'weapi')
		if (signal) {
			requestOptions.signal = signal
		}
		return createRequest<object, NeteaseSearchResponse>(
			endpoint,
			data,
			requestOptions,
		).map((res) => {
			if (!res.body.result?.songs) return []
			return res.body.result.songs.map((song) => ({
				source: 'netease' as const,
				duration: song.dt / 1000,
				title: song.name,
				artist: song.ar[0].name,
				remoteId: song.id,
			}))
		})
	}

	public parseLyrics(
		lyricsResponse: NeteaseLyricResponse,
	): LyricProviderResponseData {
		const haveYrc = !!lyricsResponse.yrc?.lyric
		const lyricData: LyricProviderResponseData = {
			lrc: haveYrc
				? parseYrc(lyricsResponse.yrc!.lyric)
				: lyricsResponse.lrc.lyric,
			tlyric: haveYrc
				? lyricsResponse.ytlrc?.lyric
				: lyricsResponse.tlyric?.lyric,
			romalrc: haveYrc
				? lyricsResponse.yromalrc?.lyric
				: lyricsResponse.romalrc?.lyric,
		}

		return lyricData
	}

	public searchBestMatchedLyrics(
		keyword: string,
		_targetDurationMs: number,
		signal?: AbortSignal,
	): ResultAsync<LyricProviderResponseData, NeteaseApiError> {
		return this.search({ keywords: keyword, limit: 10 }, signal).andThen(
			(searchResult) => {
				if (searchResult.length === 0) {
					return errAsync(
						new NeteaseApiError({
							message: '未搜索到相关歌曲\n\n搜索关键词：' + keyword,
							type: 'SearchResultNoMatch',
						}),
					)
				}

				// const bestMatch = this.findBestMatch(songs, keyword, targetDurationMs)
				// 相信网易云... 哥们儿写的规则太屎了
				const bestMatch = searchResult[0]

				return this.getLyrics(bestMatch.remoteId as number, signal).andThen(
					(lyricsResponse) => {
						const lyricData = this.parseLyrics(lyricsResponse)
						return okAsync(lyricData)
					},
				)
			},
		)
	}

	getPlaylist(
		id: string,
	): ResultAsync<NeteasePlaylistResponse, NeteaseApiError> {
		const data = {
			s: '0',
			id: id,
			n: '1000',
			t: '0',
		}
		const requestOptions: RequestOptions = createOption({}, 'eapi')
		return createRequest<object, NeteasePlaylistResponse>(
			'/api/v6/playlist/detail',
			data,
			requestOptions,
		).map((res) => res.body)
	}
}

export const neteaseApi = new NeteaseApi()
