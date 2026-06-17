import { useInfiniteQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const themeQueryKeys = {
	all: ['bilibili', 'theme'] as const,
	results: (keyword: string) => [...themeQueryKeys.all, keyword] as const,
} as const

export function useThemeSearch(keyword: string) {
	return useInfiniteQuery({
		queryKey: themeQueryKeys.results(keyword),
		queryFn: async ({ pageParam, signal }) => {
			const res = await returnOrThrowAsync(
				bilibiliApi.searchGarbSkins({
					keyword,
					signal,
					page: pageParam,
					pageSize: 5,
				}),
			)
			return res
		},
		initialPageParam: 1,
		enabled: !!keyword,
		getNextPageParam: (lastPage) => {
			const isEnd = lastPage.pn * lastPage.ps >= lastPage.total
			if (isEnd) return undefined
			return lastPage.pn + 1
		},
	})
}
