import { neteaseApi } from '@/lib/api/netease/api'
import lyricService from '@/lib/services/lyricService'
import type { Track } from '@/types/core/media'
import * as Sentry from '@sentry/react-native'
import { useQuery } from '@tanstack/react-query'

export const lyricsQueryKeys = {
	all: ['lyrics'] as const,
	smartFetchLyrics: (uniqueKey?: string) =>
		[...lyricsQueryKeys.all, 'smartFetchLyrics', uniqueKey] as const,
	manualSearch: (uniqueKey?: string, query?: string) =>
		[...lyricsQueryKeys.all, 'manualSearch', uniqueKey, query] as const,
}

export const useSmartFetchLyrics = (enable: boolean, track?: Track) => {
	const enabled = !!track && enable
	return useQuery({
		queryKey: lyricsQueryKeys.smartFetchLyrics(track?.uniqueKey),
		queryFn: () =>
			Sentry.startSpan(
				{
					name: 'query:lyrics:smartFetchLyrics',
					op: 'function',
				},
				async () => {
					const result = await lyricService.smartFetchLyrics(track!)
					if (result.isErr()) {
						if (result.error.type === 'SearchResultNoMatch') {
							return {
								lyrics: null,
								rawOriginalLyrics: result.error.message, // 就这样 hack 一下
								tags: {},
							}
						}
						throw result.error
					}
					return result.value
				},
			),
		enabled,
		staleTime: 0,
	})
}

export const useManualSearchLyrics = (query?: string, uniqueKey?: string) => {
	return useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, query),
		queryFn: () =>
			Sentry.startSpan(
				{
					name: 'query:lyrics:manualSearch',
					op: 'function',
				},
				async () => {
					console.log('manualSearch:', query)
					const result = await neteaseApi.search({
						keywords: query!,
						limit: 20,
					})
					if (result.isErr()) {
						throw result.error
					}
					return result.value
				},
			),
		enabled: false,
		staleTime: 0,
	})
}
