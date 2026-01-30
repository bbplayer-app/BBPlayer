import { useMutation } from '@tanstack/react-query'

import { videoDataQueryKeys } from '@/hooks/queries/bilibili/video'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { queryClient } from '@/lib/config/queryClient'
import type { BilibiliToViewVideoList } from '@/types/apis/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import toast from '@/utils/toast'

export const useThumbUpVideo = () => {
	return useMutation({
		mutationFn: ({ bvid, like }: { bvid: string; like: boolean }) =>
			returnOrThrowAsync(
				bilibiliApi.thumbUpVideo(bvid, like).map((res) => res ?? undefined),
			),
		onSuccess: (_, { bvid, like }) => {
			queryClient.setQueryData(
				videoDataQueryKeys.getVideoIsThumbUp(bvid),
				like ? 1 : 0,
			)
			toast.success(`${like ? '点赞' : '取消点赞'}成功`)
		},
		onError: (err, { like }) => {
			toastAndLogError(`${like ? '点赞' : '取消点赞'}失败`, err, 'UI.Player')
		},
	})
}

export const useDeleteToViewVideo = () => {
	return useMutation({
		mutationFn: ({
			deleteAllViewed,
			avid,
		}: {
			deleteAllViewed?: boolean
			avid?: number
		}) =>
			returnOrThrowAsync(
				bilibiliApi.deleteToViewVideo(deleteAllViewed, avid).map(() => true),
			),
		onMutate: async ({ deleteAllViewed, avid }, context) => {
			await context.client.cancelQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
			const previousData = context.client.getQueryData(
				videoDataQueryKeys.getToViewVideoList(),
			)
			context.client.setQueryData(
				videoDataQueryKeys.getToViewVideoList(),
				(oldData: BilibiliToViewVideoList) => {
					if (!oldData) return undefined
					if (deleteAllViewed) {
						const newItems = oldData.list.filter((item) => item.progress !== -1)
						return {
							count: newItems.length,
							list: newItems,
						}
					} else {
						const newItems = oldData.list.filter((item) => item.aid !== avid)
						return {
							count: newItems.length,
							list: newItems,
						}
					}
				},
			)
			return { previousData }
		},
		onSettled: async (
			_d,
			error,
			{ deleteAllViewed },
			onMutateResult,
			context,
		) => {
			if (error) {
				toastAndLogError(
					deleteAllViewed ? '清除稍后再看列表失败' : '删除失败',
					error,
					'Mutation.Bilibili.Video',
				)
				context.client.setQueryData(
					videoDataQueryKeys.getToViewVideoList(),
					onMutateResult?.previousData,
				)
			} else {
				toast.success(deleteAllViewed ? '清除稍后再看列表成功' : '删除成功')
			}
			await context.client.invalidateQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
		},
	})
}

export const useClearToViewVideoList = () => {
	return useMutation({
		mutationFn: () =>
			returnOrThrowAsync(bilibiliApi.clearToViewVideoList().map(() => true)),
		// onSuccess: () => {
		// 	queryClient.setQueryData(videoDataQueryKeys.getToViewVideoList(), {
		// 		count: 0,
		// 		list: [],
		// 	})
		// 	toast.success('清除稍后再看列表成功')
		// },
		// onError: (err) => {
		// 	toastAndLogError('清除稍后再看列表失败', err, 'UI.Player')
		// },
		onMutate: async (_, context) => {
			await context.client.cancelQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
			const previousData = context.client.getQueryData(
				videoDataQueryKeys.getToViewVideoList(),
			)
			context.client.setQueryData(videoDataQueryKeys.getToViewVideoList(), {
				count: 0,
				list: [],
			})
			return { previousData }
		},
		onSettled: async (_d, error, _v, onMutateResult, context) => {
			if (error) {
				toastAndLogError(
					'清除稍后再看列表失败',
					error,
					'Mutation.Bilibili.Video',
				)
				context.client.setQueryData(
					videoDataQueryKeys.getToViewVideoList(),
					onMutateResult?.previousData,
				)
			} else {
				toast.success('清除稍后再看列表成功')
			}
			await context.client.invalidateQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
		},
	})
}
