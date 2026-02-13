import { useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { kugouApi } from '@/lib/api/kugou/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import lyricService from '@/lib/services/lyricService'
import type { Track } from '@/types/core/media'
import type { LyricFileData, LyricSearchResult } from '@/types/player/lyrics'

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
		// oxlint-disable-next-line @tanstack/query/exhaustive-deps
		queryKey: lyricsQueryKeys.smartFetchLyrics(track?.uniqueKey),
		queryFn: async () => {
			const result = await lyricService.smartFetchLyrics(track!)
			if (result.isErr()) {
				if (result.error.type === 'LyricNotFound') {
					return {
						id: track!.uniqueKey,
						updateTime: Date.now(),
						lrc: result.error.message,
						tlyric: undefined,
						romalrc: undefined,
						misc: undefined,
					} satisfies LyricFileData
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

	const [results, setResults] = useState<LyricSearchResult>([])
	const processedProvidersRef = useRef<Set<string>>(new Set())

	// Effect to reset results when query changes
	useEffect(() => {
		// oxlint-disable-next-line react-you-might-not-need-an-effect/no-chain-state-updates
		setResults([])
		processedProvidersRef.current = new Set()
	}, [searchQuery])

	const queries = useQueries({
		queries: [
			{
				queryKey: lyricsQueryKeys.manualSearch(
					uniqueKey,
					`netease-${searchQuery}`,
				),
				queryFn: async ({ signal }) => {
					if (!searchQuery) return []
					const res = await neteaseApi.search(
						{
							keywords: searchQuery,
							limit: 20,
						},
						signal,
					)
					if (res.isOk()) {
						return res.value
					}
					throw res.error
				},
				enabled: !!searchQuery,
				staleTime: 0,
			},
			{
				queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `qq-${searchQuery}`),
				queryFn: async ({ signal }) => {
					if (!searchQuery) return []
					const res = await qqMusicApi.search(searchQuery, 20, signal)
					if (res.isOk()) {
						return res.value
					}
					throw res.error
				},
				enabled: !!searchQuery,
				staleTime: 0,
			},
			{
				queryKey: lyricsQueryKeys.manualSearch(
					uniqueKey,
					`kugou-${searchQuery}`,
				),
				queryFn: async ({ signal }) => {
					if (!searchQuery) return []
					const res = await kugouApi.search(searchQuery, 20, signal)
					if (res.isOk()) {
						return res.value
					}
					throw res.error
				},
				enabled: !!searchQuery,
				staleTime: 0,
			},
		],
	})

	const neteaseQuery = queries[0]
	const qqQuery = queries[1]
	const kugouQuery = queries[2]

	const neteaseData = neteaseQuery.data
	const qqData = qqQuery.data
	const kugouData = kugouQuery.data

	// Effect to append results as they arrive
	useEffect(() => {
		const processResult = (
			providerName: string,
			data: LyricSearchResult | undefined,
		) => {
			if (data && !processedProvidersRef.current.has(providerName)) {
				setResults((prev) => [...prev, ...data])
				processedProvidersRef.current.add(providerName)
			}
		}

		if (neteaseData) processResult('netease', neteaseData)
		if (qqData) processResult('qq', qqData)
		if (kugouData) processResult('kugou', kugouData)
	}, [neteaseData, qqData, kugouData])

	const triggerSearch = useCallback((query: string) => {
		setSearchQuery(query)
	}, [])

	const isLoading = queries.some((q) => q.isFetching)

	return {
		search: triggerSearch,
		results,
		isLoading,
		errors: {
			netease: neteaseQuery.error,
			qq: qqQuery.error,
			kugou: kugouQuery.error,
		},
	}
}
