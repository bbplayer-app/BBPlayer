import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import log from '@/utils/log'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

const logger = log.extend('Queries.SearchQueries')

export const searchQueryKeys = {
	all: ['bilibili', 'search'] as const,
	results: (query: string) =>
		[...searchQueryKeys.all, 'results', query] as const,
	hotSearches: () => [...searchQueryKeys.all, 'hotSearches'] as const,
	suggestions: (query: string) =>
		[...searchQueryKeys.all, 'suggestions', query] as const,
	users: (query: string) => [...searchQueryKeys.all, 'users', query],
} as const

// 搜索结果查询
export const useSearchResults = (query: string) => {
	const enabled = query.trim().length > 0
	return useInfiniteQuery({
		queryKey: searchQueryKeys.results(query),
		queryFn: ({ pageParam = 1, signal }) =>
			returnOrThrowAsync(
				bilibiliApi.searchVideos({
					keyword: query,
					page: pageParam,
					signal,
				}),
			),
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

// 搜索用户查询
export const useUserSearchResults = (query: string) => {
	const enabled = query.trim().length > 0
	return useQuery({
		queryKey: searchQueryKeys.users(query),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(
				bilibiliApi.searchUsers({ keyword: query, page: 1, signal }),
			),
		enabled,
		staleTime: 5 * 60 * 1000,
	})
}

// 热门搜索查询
export const useHotSearches = () => {
	return useQuery({
		queryKey: searchQueryKeys.hotSearches(),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getHotSearches({ signal })),
		staleTime: 15 * 60 * 1000,
	})
}

// 搜索建议查询
export const useSearchSuggestions = (query: string) => {
	const enabled = query.trim().length > 0
	return useQuery({
		queryKey: searchQueryKeys.suggestions(query),
		queryFn: async ({ signal }) => {
			const result = await bilibiliApi.getSearchSuggestions({
				term: query,
				signal,
			})
			if (result.isErr()) {
				logger.warning('搜索建议查询失败，但无关紧要', { query })
				return []
			}
			return result.value
		},
		enabled,
		staleTime: 0,
	})
}
