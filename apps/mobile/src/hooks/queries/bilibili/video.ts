import useAppStore from '@/hooks/stores/useAppStore'
import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const videoDataQueryKeys = {
	all: ['bilibili', 'videoData'] as const,
	getMultiPageList: (bvid?: string) =>
		[...videoDataQueryKeys.all, 'getMultiPageList', bvid] as const,
	getVideoDetails: (bvid?: string) =>
		[...videoDataQueryKeys.all, 'getVideoDetails', bvid] as const,
	getVideoIsThumbUp: (bvid?: string) =>
		[...videoDataQueryKeys.all, 'getVideoIsThumbUp', bvid] as const,
	getWebPlayerInfo: (bvid?: string, cid?: number) =>
		[...videoDataQueryKeys.all, 'getWebPlayerInfo', bvid, cid] as const,
	getToViewVideoList: () =>
		[...videoDataQueryKeys.all, 'getToViewVideoList'] as const,
} as const

/**
 * 获取分P列表
 */
export const useGetMultiPageList = (bvid: string | undefined) => {
	const enabled = !!bvid

	return useTracedQuery({
		span: { name: 'bilibili.video.multi_page_list' },
		queryKey: videoDataQueryKeys.getMultiPageList(bvid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getPageList({ bvid: bvid!, signal }),
			),
		enabled,
		staleTime: 1,
	})
}

/**
 * 获取视频详细信息
 */
export const useGetVideoDetails = (bvid: string | undefined) => {
	const enabled = !!bvid

	return useTracedQuery({
		span: { name: 'bilibili.video.details' },
		queryKey: videoDataQueryKeys.getVideoDetails(bvid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getVideoDetails({ bvid: bvid!, signal }),
			),
		enabled,
		staleTime: 60 * 60 * 1000, // 我们不需要获取实时的视频详细信息
	})
}

/**
 * 检查视频是否已经点赞
 */
export const useGetVideoIsThumbUp = (bvid: string | undefined) => {
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = !!bvid && hasCookie

	return useTracedQuery({
		span: { name: 'bilibili.video.is_thumb_up' },
		queryKey: videoDataQueryKeys.getVideoIsThumbUp(bvid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi
					.withTrace(span)
					.checkVideoIsThumbUp({ bvid: bvid!, signal }),
			),
		enabled,
		staleTime: 0,
	})
}

/**
 * 获取 web 播放器信息
 */
export const useGetWebPlayerInfo = (
	bvid: string | undefined,
	cid: number | undefined,
) => {
	const enabled = !!bvid && !!cid

	return useTracedQuery({
		span: { name: 'bilibili.video.web_player_info' },
		queryKey: videoDataQueryKeys.getWebPlayerInfo(bvid, cid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi
					.withTrace(span)
					.getWebPlayerInfo({ bvid: bvid!, cid: cid!, signal }),
			),
		enabled,
		staleTime: 5 * 60 * 1000,
	})
}

/**
 * 获取稍后再看视频列表
 */
export const useGetToViewVideoList = () => {
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = hasCookie

	return useTracedQuery({
		span: { name: 'bilibili.to_view.list' },
		queryKey: videoDataQueryKeys.getToViewVideoList(),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getToViewVideoList({ signal }),
			),
		enabled,
		staleTime: 0,
	})
}
