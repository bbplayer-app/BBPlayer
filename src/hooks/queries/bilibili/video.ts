import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { effectToPromise } from '@/utils/effect'
import { useQuery } from '@tanstack/react-query'

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
	return useQuery({
		queryKey: videoDataQueryKeys.getMultiPageList(bvid),
		queryFn: () => effectToPromise(bilibiliApi.getPageList(bvid!), true),
		enabled,
		staleTime: 1,
	})
}

/**
 * 获取视频详细信息
 */
export const useGetVideoDetails = (bvid: string | undefined) => {
	const enabled = !!bvid
	return useQuery({
		queryKey: videoDataQueryKeys.getVideoDetails(bvid),
		queryFn: () => effectToPromise(bilibiliApi.getVideoDetails(bvid!), true),
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
	return useQuery({
		queryKey: videoDataQueryKeys.getVideoIsThumbUp(bvid),
		queryFn: () =>
			effectToPromise(bilibiliApi.checkVideoIsThumbUp(bvid!), true),
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
	return useQuery({
		queryKey: videoDataQueryKeys.getWebPlayerInfo(bvid, cid),
		queryFn: () =>
			effectToPromise(bilibiliApi.getWebPlayerInfo(bvid!, cid!), true),
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
	return useQuery({
		queryKey: videoDataQueryKeys.getToViewVideoList(),
		queryFn: () => effectToPromise(bilibiliApi.getToViewVideoList(), true),
		enabled,
		staleTime: 0,
	})
}
