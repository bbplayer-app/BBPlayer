import { useMutation } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const useLikeComment = () => {
	return useMutation({
		mutationFn: async (params: {
			bvid: string
			rpid: number
			newAction: 0 | 1
		}) => {
			const { bvid, rpid, newAction } = params
			return await returnOrThrowAsync(
				bilibiliApi.likeComment(bvid, rpid, newAction),
			)
		},
	})
}
