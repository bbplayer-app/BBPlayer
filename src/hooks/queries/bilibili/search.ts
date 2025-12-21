import { bilibiliApi } from '@/lib/api/bilibili/api'
import { effectToPromise } from '@/utils/effect'
import log from '@/utils/log'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

const logger = log.extend('Queries.SearchQueries')

export const searchQueryKeys = {
	all: ['bilibili', 'search'] as const,
	results: (query: string) =>
		[...searchQueryKeys.all, 'results', query] as const,
	hotSearches: () => [...searchQueryKeys.all, 'hotSearches'] as const,
	suggestions: (query: string) =>
		[...searchQueryKeys.all, 'suggestions', query] as const,
} as const

// 搜索结果查询
export const useSearchResults = (query: string) => {
	const enabled = query.trim().length > 0
	return useInfiniteQuery({
		queryKey: searchQueryKeys.results(query),
		queryFn: ({ pageParam = 1 }) =>
			effectToPromise(bilibiliApi.searchVideos(query, pageParam), true),
		enabled,
		staleTime: 5 * 60 * 1000,
		initialPageParam: 1,
		getNextPageParam: (lastPage, allPages) => {
			if (lastPage.numPages === 0) {
				return undefined
			}
			if (lastPage.numPages === allPages.length) {
				return undefined
			}
			return allPages.length + 1
		},
	})
}

// 热门搜索查询
export const useHotSearches = () => {
	return useQuery({
		queryKey: searchQueryKeys.hotSearches(),
		queryFn: () => effectToPromise(bilibiliApi.getHotSearches(), true),
		staleTime: 15 * 60 * 1000,
	})
}

// 搜索建议查询
export const useSearchSuggestions = (query: string) => {
	const enabled = query.trim().length > 0
	return useQuery({
		queryKey: searchQueryKeys.suggestions(query),
		queryFn: async () => {
			try {
				const result = await effectToPromise(
					bilibiliApi.getSearchSuggestions(query),
					true,
				)
				return result
			} catch (_e) {
				logger.warning('搜索建议查询失败，但无关紧要', { query })
				return []
			}
		},
		enabled,
		staleTime: 0,
	})
}
