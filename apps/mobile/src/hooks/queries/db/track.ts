import {
	useTracedInfiniteQuery,
	useTracedQuery,
} from '@/hooks/utils/useTracedQuery'
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
	// 放在 history 下面：每写入一条播放记录都会让它失效，页面开着也能跟着更新
	lastPlayRecordOfVideo: (bvid: string) =>
		[...trackKeys.history(), 'lastPlayRecordOfVideo', bvid] as const,
}

export function usePlayCountHistoryPaginated(
	limit: number,
	onlyCompleted: boolean,
	initialLimit?: number,
) {
	return useTracedInfiniteQuery({
		span: { name: 'play_history.play_count_paginated' },
		queryKey: trackKeys.historyContentPaginated(
			limit,
			onlyCompleted,
			initialLimit,
		),

		queryFn: async ({ pageParam, span }) =>
			returnOrThrowAsync(
				trackService.withTrace(span).getPlayCountHistoryPaginated({
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

export function useLastPlayRecordOfVideo(bvid: string) {
	return useTracedQuery({
		span: { name: 'play_history.last_record_of_video' },
		queryKey: trackKeys.lastPlayRecordOfVideo(bvid),
		queryFn: async ({ span }) => {
			const result = await trackService
				.withTrace(span)
				.getLastPlayRecordOfVideo(bvid)

			if (result.isErr()) throw result.error

			// 没有播放记录时返回 null，这是正常结果；returnOrThrowAsync 会把 null 当成错误抛出
			return result.value
		},
	})
}

export function useTotalPlaybackDuration(onlyCompleted = true) {
	return useTracedQuery({
		span: { name: 'play_history.total_duration' },
		queryKey: trackKeys.totalPlaybackDuration(onlyCompleted),
		queryFn: ({ span }) =>
			returnOrThrowAsync(
				trackService
					.withTrace(span)
					.getTotalPlaybackDuration({ onlyCompleted }),
			),
	})
}
