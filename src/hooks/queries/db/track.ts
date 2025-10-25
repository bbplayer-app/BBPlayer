import { queryClient } from '@/lib/config/queryClient'
import { trackService } from '@/lib/services/trackService'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

queryClient.setQueryDefaults(['db', 'tracks'], {
	retry: false,
	staleTime: 0,
})

export const trackKeys = {
	all: ['db', 'tracks'] as const,
	leaderBoardPaged: (limit: number, onlyCompleted: boolean) =>
		[
			...trackKeys.all,
			'leaderBoard',
			'pagination',
			limit,
			onlyCompleted,
		] as const,
	totalPlaybackDuration: (onlyCompleted: boolean) =>
		[...trackKeys.all, 'totalPlaybackDuration', onlyCompleted] as const,
}

export function usePlayCountLeaderboard(
	props: {
		limit?: number
		onlyCompleted?: boolean
	} = {},
) {
	const { limit = 20, onlyCompleted = true } = props

	return useInfiniteQuery({
		queryKey: trackKeys.leaderBoardPaged(limit, onlyCompleted),

		queryFn: async ({ pageParam }) =>
			returnOrThrowAsync(
				trackService.getPlayCountLeaderboard({
					limit,
					onlyCompleted,
					cursor: pageParam,
				}),
			),
		initialPageParam: undefined as
			| { lastPlayCount: number; lastUpdatedAt: number; lastId: number }
			| undefined,
		getNextPageParam: (lastPage) => {
			return lastPage.nextCursor
		},
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
