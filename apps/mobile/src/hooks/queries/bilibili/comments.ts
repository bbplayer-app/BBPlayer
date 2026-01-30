import { useInfiniteQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const commentQueryKeys = {
	all: ['bilibili', 'comments'] as const,
	results: (bvid: string, mode: number) =>
		[...commentQueryKeys.all, bvid, mode] as const,
	reply: (bvid: string, rpid: number) =>
		[...commentQueryKeys.all, 'reply', bvid, rpid] as const,
} as const

export function useComments(bvid: string, mode = 3) {
	return useInfiniteQuery({
		queryKey: commentQueryKeys.results(bvid, mode),
		queryFn: async ({ pageParam }) => {
			const res = await returnOrThrowAsync(
				bilibiliApi.getComments(bvid, pageParam, mode),
			)
			return res
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage) => {
			if (lastPage.cursor.is_end) return undefined
			return lastPage.cursor.next
		},
	})
}

export function useReplyComments(bvid: string, rpid: number) {
	return useInfiniteQuery({
		queryKey: commentQueryKeys.reply(bvid, rpid),
		queryFn: async ({ pageParam }) => {
			const res = await returnOrThrowAsync(
				bilibiliApi.getReplyComments(bvid, rpid, pageParam),
			)
			return res
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const totalPages = Math.ceil(lastPage.page.count / lastPage.page.size)
			if (lastPage.page.num >= totalPages) return undefined
			return lastPage.page.num + 1
		},
	})
}
