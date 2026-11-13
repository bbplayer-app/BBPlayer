import { Image } from 'expo-image'

import useAppStore from '@/hooks/stores/useAppStore'
import {
	useTracedInfiniteQuery,
	useTracedQuery,
} from '@/hooks/utils/useTracedQuery'
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

	return useTracedQuery({
		span: { name: 'bilibili.user.self_info' },
		queryKey: userQueryKeys.personalInformation(),
		queryFn: async ({ signal, span }) => {
			const res = await returnOrThrowAsync(
				bilibiliApi.withTrace(span).getUserInfo({ signal }),
			)

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

	return useTracedQuery({
		span: { name: 'bilibili.user.recently_played' },
		queryKey: userQueryKeys.recentlyPlayed(),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(bilibiliApi.withTrace(span).getHistory({ signal })),
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

	return useTracedInfiniteQuery({
		span: { name: 'bilibili.user.uploaded_videos' },
		queryKey: userQueryKeys.uploadedVideos(mid, keyword),
		queryFn: ({ pageParam, signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getUserUploadedVideos({
					mid,
					pn: pageParam,
					keyword,
					signal,
				}),
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

export const useOtherUserInfo = (mid: number, requireCookie = true) => {
	// 这个接口有风控校验
	const hasCookie = useAppStore((s) => s.hasBilibiliCookie())
	const enabled = !!mid && (!requireCookie || hasCookie)

	return useTracedQuery({
		span: { name: 'bilibili.user.info' },
		queryKey: userQueryKeys.otherUserInfo(mid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getOtherUserInfo({ mid, signal }),
			),
		enabled,
		staleTime: 24 * 60 * 1000, // 不需要刷新太频繁
	})
}
