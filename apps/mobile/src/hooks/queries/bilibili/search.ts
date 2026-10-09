import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { isBilibiliRateLimitError } from '@/lib/errors/thirdparty/bilibili'
import log from '@/utils/log'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

const logger = log.extend('Queries.SearchQueries')

const MAX_SEARCH_RETRIES = 2

export const shouldRetryBilibiliSearch = (
	failureCount: number,
	error: unknown,
): boolean => {
	if (isBilibiliRateLimitError(error)) {
		return false
	}
	return failureCount < MAX_SEARCH_RETRIES
}

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
		queryFn: ({ pageParam, signal }) =>
			returnOrThrowAsync(
				bilibiliApi.searchVideos({
					keyword: query,
					page: pageParam,
					signal,
				}),
			),
		enabled,
		retry: shouldRetryBilibiliSearch,
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
		retry: shouldRetryBilibiliSearch,
		staleTime: 5 * 60 * 1000,
	})
}

// 热门搜索查询
export const useHotSearches = () => {
	return useQuery({
		queryKey: searchQueryKeys.hotSearches(),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getHotSearches({ signal })),
		retry: shouldRetryBilibiliSearch,
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
