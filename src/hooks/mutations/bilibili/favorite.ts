import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { effectToPromise } from '@/utils/effect'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import toast from '@/utils/toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'

const logger = log.extend('Mutation.Bilibili.Favorite')

/**
 * 单个视频添加/删除到多个收藏夹
 */
export const useDealFavoriteForOneVideo = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (params: {
			bvid: string
			addToFavoriteIds: string[]
			delInFavoriteIds: string[]
		}) => {
			const program = bilibiliApi
				.dealFavoriteForOneVideo(
					params.bvid,
					params.addToFavoriteIds,
					params.delInFavoriteIds,
				)
				.pipe(
					Effect.catchTag('BilibiliCsrfError', () =>
						Effect.fail(new Error('CSRF token 过期，请检查 cookie 后重试')),
					),
					Effect.mapError((e) => {
						if (e instanceof Error)
							return new Error(
								`操作失败: ${e.message} (${(e as Error & { _tag?: string })._tag ?? 'UnknownError'})`,
							)
					}),
				)

			return await effectToPromise(program)
		},
		onSuccess: async (_data, _value) => {
			toast.success('操作成功', {
				description:
					_data.toast_msg.length > 0
						? `api 返回消息：${_data.toast_msg}`
						: undefined,
			})
			// 只刷新当前显示的收藏夹
			await queryClient.refetchQueries({
				queryKey: ['bilibili', 'favoriteList', 'infiniteFavoriteList'],
				type: 'active',
			})
		},
		onError: (error) => {
			toast.error('操作失败', {
				description: error.message,
				duration: Number.POSITIVE_INFINITY,
			})
			logger.error('删除收藏夹内容失败:', error)
		},
	})
}

/**
 * 删除收藏夹内容
 */
export const useBatchDeleteFavoriteListContents = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (params: { bvids: string[]; favoriteId: number }) => {
			const program = bilibiliApi
				.batchDeleteFavoriteListContents(params.favoriteId, params.bvids)
				.pipe(
					Effect.catchTag('BilibiliCsrfError', () =>
						Effect.fail(new Error('CSRF token 过期，请检查 cookie 后重试')),
					),
					Effect.mapError((e) => {
						if (e instanceof Error)
							return new Error(
								`删除失败: ${e.message} (${(e as Error & { _tag?: string })._tag ?? 'UnknownError'})`,
							)
					}),
				)

			return await effectToPromise(program)
		},
		onSuccess: async (_data, variables) => {
			toast.success('删除成功')
			await queryClient.refetchQueries({
				queryKey: favoriteListQueryKeys.infiniteFavoriteList(
					variables.favoriteId,
				),
			})
		},
		onError: (error) => {
			toastAndLogError(error.message, error, 'Query.Bilibili.Favorite')
		},
	})
}
