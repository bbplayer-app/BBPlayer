import { useTracedInfiniteQuery } from '@/hooks/utils/useTracedQuery'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const themeQueryKeys = {
	all: ['bilibili', 'theme'] as const,
	results: (keyword: string) => [...themeQueryKeys.all, keyword] as const,
} as const

export function useThemeSearch(keyword: string) {
	return useTracedInfiniteQuery({
		span: { name: 'bilibili.theme.search' },
		queryKey: themeQueryKeys.results(keyword),
		queryFn: async ({ pageParam, signal, span }) => {
			const res = await returnOrThrowAsync(
				bilibiliApi.withTrace(span).searchGarbSkins({
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
