import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { queryClient } from '@/lib/config/queryClient'
import { trackService } from '@/lib/services/trackService'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

queryClient.setQueryDefaults(['db', 'tracks'], {
	retry: false,
	staleTime: 0,
	networkMode: 'always',
})

export const trackKeys = {
	all: ['db', 'tracks'] as const,
	history: () => [...trackKeys.all, 'history'] as const,
	historyContentPaginated: (
		limit: number,
		onlyCompleted: boolean,
		initialLimit?: number,
	) =>
		[
			...trackKeys.history(),
			'contentPaginated',
			limit,
			onlyCompleted,
			initialLimit,
		] as const,
	totalPlaybackDuration: (onlyCompleted: boolean) =>
		[...trackKeys.history(), 'totalPlaybackDuration', onlyCompleted] as const,
}

export function usePlayCountHistoryPaginated(
	limit: number,
	onlyCompleted: boolean,
	initialLimit?: number,
) {
	return useInfiniteQuery({
		queryKey: trackKeys.historyContentPaginated(
			limit,
			onlyCompleted,
			initialLimit,
		),

		queryFn: async ({ pageParam }) =>
			returnOrThrowAsync(
				trackService.getPlayCountHistoryPaginated({
					limit,
					onlyCompleted,
					initialLimit,
					cursor: pageParam,
				}),
			),
		initialPageParam: undefined as
			| { lastPlayCount: number; lastUpdatedAt: number; lastId: number }
			| undefined,
		getNextPageParam: (lastPage) => {
			return lastPage.nextCursor
		},
		// 每次打开页面都重新获取数据，避免直接加载缓存中的大量数据导致卡顿
		gcTime: 0,
	})
}

export function useTotalPlaybackDuration(onlyCompleted = true) {
	return useQuery({
		queryKey: trackKeys.totalPlaybackDuration(onlyCompleted),
		queryFn: () =>
			returnOrThrowAsync(
				trackService.getTotalPlaybackDuration({ onlyCompleted }),
			),
	})
}
