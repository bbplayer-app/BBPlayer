import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'

import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const userQueryKeys = {
	all: ['bilibili', 'user'] as const,
	personalInformation: () =>
		[...userQueryKeys.all, 'personalInformation'] as const,
	recentlyPlayed: () => [...userQueryKeys.all, 'recentlyPlayed'] as const,
	uploadedVideos: (mid: number, keyword?: string) =>
		[...userQueryKeys.all, 'uploadedVideos', mid, keyword ?? ''] as const,
	otherUserInfo: (mid: number) =>
		[...userQueryKeys.all, 'otherUserInfo', mid] as const,
}

export const usePersonalInformation = () => {
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = hasCookie

	return useQuery({
		queryKey: userQueryKeys.personalInformation(),
		queryFn: async () => {
			const res = await returnOrThrowAsync(bilibiliApi.getUserInfo())
			// 缓存用户信息和头像供离线时显示
			if (res.name) {
				useAppStore.getState().setBilibiliUserInfo({
					mid: res.mid,
					name: res.name,
					face: res.face,
					cachedAt: Date.now(),
				})
				if (res.face) {
					Image.prefetch(res.face, 'disk').catch(() => {
						// Ignore error
					})
				}
			}
			return res
		},
		enabled,
		initialData: () => {
			const storeData = useAppStore.getState().bilibiliUserInfo
			if (storeData && storeData.name) {
				return {
					mid: storeData.mid ?? 0,
					name: storeData.name,
					face: storeData.face,
				} as import('@/types/apis/bilibili').BilibiliUserInfo
			}
			return undefined
		},
		initialDataUpdatedAt: () => {
			return useAppStore.getState().bilibiliUserInfo?.cachedAt ?? 0
		},
		staleTime: 24 * 60 * 1000, // 不需要刷新太频繁
	})
}

export const useRecentlyPlayed = () => {
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = hasCookie
	return useQuery({
		queryKey: userQueryKeys.recentlyPlayed(),
		queryFn: () => returnOrThrowAsync(bilibiliApi.getHistory()),
		enabled,
		staleTime: 1 * 60 * 1000,
	})
}

export const useInfiniteGetUserUploadedVideos = (
	mid: number,
	keyword?: string,
) => {
	// 这个接口有风控校验
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = !!mid && hasCookie
	return useInfiniteQuery({
		queryKey: userQueryKeys.uploadedVideos(mid, keyword),
		queryFn: ({ pageParam }) =>
			returnOrThrowAsync(
				bilibiliApi.getUserUploadedVideos(mid, pageParam, keyword),
			),
		enabled,
		getNextPageParam: (lastPage) => {
			const nowLoaded = lastPage.page.pn * lastPage.page.ps
			if (nowLoaded >= lastPage.page.count) {
				return undefined
			}
			return lastPage.page.pn + 1
		},
		initialPageParam: 1,
		staleTime: 1,
	})
}

export const useOtherUserInfo = (mid: number) => {
	// 这个接口有风控校验
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = !!mid && hasCookie
	return useQuery({
		queryKey: userQueryKeys.otherUserInfo(mid),
		queryFn: () => returnOrThrowAsync(bilibiliApi.getOtherUserInfo(mid)),
		enabled,
		staleTime: 24 * 60 * 1000, // 不需要刷新太频繁
	})
}
