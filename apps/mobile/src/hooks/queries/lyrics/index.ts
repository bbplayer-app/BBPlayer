import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { baiduApi } from '@/lib/api/baidu/api'
import { kugouApi } from '@/lib/api/kugou/api'
import { kuwoApi } from '@/lib/api/kuwo/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import lyricService from '@/lib/services/lyricService'
import type { Track } from '@/types/core/media'

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
				if (result.error.type === 'LyricNotFound') {
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

	const kuwoQuery = useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `kuwo-${searchQuery}`),
		queryFn: async () => {
			if (!searchQuery) return []
			console.log('Searching Kuwo:', searchQuery)
			const res = await kuwoApi.search(searchQuery, 20)
			if (res.isOk()) {
				return res.value
			}
			throw res.error
		},
		enabled: !!searchQuery,
		staleTime: 0,
	})

	const kugouQuery = useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `kugou-${searchQuery}`),
		queryFn: async () => {
			if (!searchQuery) return []
			console.log('Searching Kugou:', searchQuery)
			const res = await kugouApi.search(searchQuery, 20)
			if (res.isOk()) {
				return res.value
			}
			throw res.error
		},
		enabled: !!searchQuery,
		staleTime: 0,
	})

	const baiduQuery = useQuery({
		queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `baidu-${searchQuery}`),
		queryFn: async () => {
			if (!searchQuery) return []
			console.log('Searching Baidu:', searchQuery)
			const res = await baiduApi.search(searchQuery, 20)
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
		const kuwoList = kuwoQuery.data ?? []
		const kugouList = kugouQuery.data ?? []
		const baiduList = baiduQuery.data ?? []
		return [...neteaseList, ...qqList, ...kuwoList, ...kugouList, ...baiduList]
	}, [
		neteaseQuery.data,
		qqMusicQuery.data,
		kuwoQuery.data,
		kugouQuery.data,
		baiduQuery.data,
	])

	const triggerSearch = useCallback((query: string) => {
		setSearchQuery(query)
	}, [])

	const isLoading =
		neteaseQuery.isFetching ||
		qqMusicQuery.isFetching ||
		kuwoQuery.isFetching ||
		kugouQuery.isFetching ||
		baiduQuery.isFetching

	return {
		search: triggerSearch,
		results: combinedResults,
		isLoading,
		errors: {
			netease: neteaseQuery.error,
			qq: qqMusicQuery.error,
			kuwo: kuwoQuery.error,
			kugou: kugouQuery.error,
			baidu: baiduQuery.error,
		},
	}
}
