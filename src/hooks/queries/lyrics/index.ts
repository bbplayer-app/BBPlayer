import { neteaseApi } from '@/lib/api/netease/api'
import { AppRuntime } from '@/lib/effect/runtime'
import { lyricService } from '@/lib/services/lyricService'
import type { Track } from '@/types/core/media'
import { effectToPromise } from '@/utils/effect'
import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'

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
		// eslint-disable-next-line @tanstack/query/exhaustive-deps
		queryKey: lyricsQueryKeys.smartFetchLyrics(track?.uniqueKey),
		queryFn: () => {
			return AppRuntime.runPromise(
				lyricService.smartFetchLyrics(track!).pipe(
					Effect.catchTag('NeteaseSearchResultNoMatch', (e) => {
						return Effect.succeed({
							lyrics: null,
							rawOriginalLyrics: e.message,
							tags: {},
							offset: 0,
							rawTranslatedLyrics: undefined,
						})
					}),
				),
			)
		},
		enabled,
		staleTime: 0,
	})
}

export const useManualSearchLyrics = (query?: string, uniqueKey?: string) => {
	return useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, query),
		queryFn: async () =>
			effectToPromise(neteaseApi.search({ keywords: query!, limit: 20 }), true),
		enabled: false,
		staleTime: 0,
	})
}
