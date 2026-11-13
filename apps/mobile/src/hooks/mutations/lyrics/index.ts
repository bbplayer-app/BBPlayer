import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { useTracedMutation } from '@/hooks/utils/useTracedQuery'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { LyricSearchResult } from '@/types/player/lyrics'
import toast from '@/utils/toast'

export const useFetchLyrics = () => {
	return useTracedMutation({
		span: { name: 'lyrics.fetch' },
		mutationKey: ['lyrics', 'fetchLyrics'],
		mutationFn: async (
			{
				uniqueKey,
				item,
			}: {
				uniqueKey: string
				item: LyricSearchResult[0]
			},
			{ span },
		) => {
			const result = await lyricService.fetchLyrics(item, uniqueKey, span)

			if (result.isErr()) {
				throw result.error
			}

			return result.value
		},
		onSuccess: (_, { uniqueKey }) => {
			toast.show('歌词获取成功')
			void queryClient.invalidateQueries({
				queryKey: lyricsQueryKeys.smartFetchLyrics(uniqueKey),
			})
		},
	})
}
