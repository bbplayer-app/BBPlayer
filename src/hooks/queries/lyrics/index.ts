import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import lyricService from '@/lib/services/lyricService'
import type { Track } from '@/types/core/media'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

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
		queryFn: async () => {
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
		enabled,
		staleTime: 0,
	})
}

export const useManualSearchLyrics = (uniqueKey?: string) => {
	const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined)

	const neteaseQuery = useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `netease-${searchQuery}`),
		queryFn: async () => {
			if (!searchQuery) return []
			console.log('Searching Netease:', searchQuery)
			const res = await neteaseApi.search({ keywords: searchQuery, limit: 20 })
			if (res.isOk()) {
				return res.value
			}
			throw res.error
		},
		enabled: !!searchQuery,
		staleTime: 0,
	})

	const qqMusicQuery = useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `qq-${searchQuery}`),
		queryFn: async () => {
			if (!searchQuery) return []
			console.log('Searching QQ:', searchQuery)
			const res = await qqMusicApi.search(searchQuery, 20)
			if (res.isOk()) {
				return res.value
			}
			throw res.error
		},
		enabled: !!searchQuery,
		staleTime: 0,
	})

	const combinedResults = useMemo(() => {
		const neteaseList = neteaseQuery.data ?? []
		const qqList = qqMusicQuery.data ?? []
		return [...neteaseList, ...qqList]
	}, [neteaseQuery.data, qqMusicQuery.data])

	const triggerSearch = useCallback((query: string) => {
		setSearchQuery(query)
	}, [])

	const isLoading = neteaseQuery.isFetching || qqMusicQuery.isFetching

	return {
		search: triggerSearch,
		results: combinedResults,
		isLoading,
		errors: {
			netease: neteaseQuery.error,
			qq: qqMusicQuery.error,
		},
	}
}
