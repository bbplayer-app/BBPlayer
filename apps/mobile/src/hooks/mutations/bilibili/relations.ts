import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
	relationQueryKeys,
	useBilibiliRelationAccount,
} from '@/hooks/queries/bilibili/relations'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { BilibiliUserRelation } from '@/types/apis/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import toast from '@/utils/toast'

export const useSetUserFollowing = (mid: number) => {
	const account = useBilibiliRelationAccount()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (following: boolean) =>
			returnOrThrowAsync(bilibiliApi.setUserFollowing({ mid, following })),
		onSuccess: async (_, following) => {
			const queryKey = relationQueryKeys.relation(account, mid)
			await queryClient.cancelQueries({ queryKey })
			queryClient.setQueryData<BilibiliUserRelation>(queryKey, (previous) => ({
				mid,
				attribute: following ? (previous?.attribute === 6 ? 6 : 2) : 0,
			}))
			toast.success(following ? '已关注' : '已取消关注')
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: relationQueryKeys.relation(account, mid),
				}),
				queryClient.invalidateQueries({
					queryKey: relationQueryKeys.followings(account),
				}),
			])
		},
		onError: (error) =>
			toastAndLogError('修改关注状态失败', error, 'Bilibili.Relations'),
	})
}
