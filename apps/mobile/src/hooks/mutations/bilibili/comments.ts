import { useTracedMutation } from '@/hooks/utils/useTracedQuery'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const useLikeComment = () => {
	return useTracedMutation({
		span: { name: 'bilibili.comment.like' },
		mutationFn: async (
			params: {
				bvid: string
				rpid: number
				newAction: 0 | 1
			},
			{ span },
		) => {
			const { bvid, rpid, newAction } = params

			return await returnOrThrowAsync(
				bilibiliApi
					.withTrace(span)
					.likeComment({ bvid, rpid, action: newAction }),
			)
		},
	})
}
