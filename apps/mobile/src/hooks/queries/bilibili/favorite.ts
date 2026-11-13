import useAppStore from '@/hooks/stores/useAppStore'
import {
	useTracedInfiniteQuery,
	useTracedQuery,
} from '@/hooks/utils/useTracedQuery'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const favoriteListQueryKeys = {
	all: ['bilibili', 'favoriteList'] as const,
	infiniteFavoriteList: (favoriteId?: number) =>
		[...favoriteListQueryKeys.all, 'infiniteFavoriteList', favoriteId] as const,
	allFavoriteList: (userMid?: number) =>
		[...favoriteListQueryKeys.all, 'allFavoriteList', userMid] as const,
	infiniteCollectionList: (mid?: number) =>
		[...favoriteListQueryKeys.all, 'infiniteCollectionList', mid] as const,
	collectionAllContents: (collectionId: number) =>
		[
			...favoriteListQueryKeys.all,
			'collectionAllContents',
			collectionId,
		] as const,
	seriesMetadata: (seriesId: number) =>
		[...favoriteListQueryKeys.all, 'seriesMetadata', seriesId] as const,
	seriesArchives: (seriesId: number, mid?: number) =>
		[...favoriteListQueryKeys.all, 'seriesArchives', seriesId, mid] as const,
	favoriteForOneVideo: (bvid: string, userMid?: number) =>
		[
			...favoriteListQueryKeys.all,
			'favoriteForOneVideo',
			bvid,
			userMid,
		] as const,
	infiniteSearchFavoriteItems: (
		scope: 'all' | 'this',
		keyword?: string,
		favoriteId?: number,
	) => {
		switch (scope) {
			case 'all':
				return [
					...favoriteListQueryKeys.all,
					'infiniteSearchFavoriteItems',
					keyword,
				] as const
			case 'this':
				return [
					...favoriteListQueryKeys.all,
					'infiniteSearchFavoriteItems',
					keyword,
					favoriteId,
				] as const
		}
	},
} as const

const useHasCookie = () => useAppStore((s) => s.hasBilibiliCookie())

/**
 * 获取某个收藏夹的内容（无限滚动）
 * @param bilibiliApi
 * @param favoriteId
 */
export const useInfiniteFavoriteList = (favoriteId?: number) => {
	const hasCookie = useHasCookie()
	const enabled = hasCookie && !!favoriteId

	return useTracedInfiniteQuery({
		span: { name: 'bilibili.favorite.contents' },
		queryKey: favoriteListQueryKeys.infiniteFavoriteList(favoriteId),
		queryFn: ({ pageParam, signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getFavoriteListContents({
					favoriteId: favoriteId!,
					pn: pageParam,
					signal,
				}),
			),
		enabled,
		initialPageParam: 1,
		getNextPageParam: (lastPage, _allPages, lastPageParam) =>
			lastPage.has_more ? lastPageParam + 1 : undefined,
		staleTime: 5 * 60 * 1000,
	})
}

/**
 * 获取收藏夹列表
 * @param bilibiliApi
 * @param userMid
 */
export const useGetFavoritePlaylists = (userMid?: number) => {
	const hasCookie = useHasCookie()
	const enabled = hasCookie && !!userMid

	return useTracedQuery({
		span: { name: 'bilibili.favorite.list' },
		queryKey: favoriteListQueryKeys.allFavoriteList(userMid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi
					.withTrace(span)
					.getFavoritePlaylists({ userMid: userMid!, signal }),
			),
		enabled,
		staleTime: 5 * 60 * 1000, // 5 minutes
	})
}

/**
 * 获取追更合集列表（分页）
 */
export const useInfiniteCollectionsList = (mid?: number) => {
	const hasCookie = useHasCookie()
	const enabled = hasCookie && !!mid

	return useTracedInfiniteQuery({
		span: { name: 'bilibili.collection.subscribed_list' },
		queryKey: favoriteListQueryKeys.infiniteCollectionList(mid),
		queryFn: ({ pageParam, signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getCollectionsList({
					pageNumber: pageParam,
					mid: mid!,
					signal,
				}),
			),
		enabled,
		initialPageParam: 1,
		getNextPageParam: (lastPage, _allPages, lastPageParam) =>
			lastPage.hasMore ? lastPageParam + 1 : undefined,
		staleTime: 1,
	})
}

/**
 * 获取合集详细信息和完整内容
 * (非登录可访问)
 */
export const useCollectionAllContents = (collectionId: number) => {
	return useTracedQuery({
		span: { name: 'bilibili.collection.all_contents' },
		queryKey: favoriteListQueryKeys.collectionAllContents(collectionId),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi
					.withTrace(span)
					.getCollectionAllContents({ collectionId, signal }),
			),
		staleTime: 1,
	})
}

export const useSeriesMetadata = (seriesId: number) => {
	return useTracedQuery({
		span: { name: 'bilibili.series.metadata' },
		queryKey: favoriteListQueryKeys.seriesMetadata(seriesId),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getSeriesMetadata({ seriesId, signal }),
			),
		enabled: Number.isSafeInteger(seriesId) && seriesId > 0,
		staleTime: 5 * 60 * 1000,
	})
}

export const useInfiniteSeriesArchives = (seriesId: number, mid?: number) => {
	return useTracedInfiniteQuery({
		span: { name: 'bilibili.series.archives' },
		queryKey: favoriteListQueryKeys.seriesArchives(seriesId, mid),
		queryFn: ({ pageParam, signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getSeriesArchivesPage({
					seriesId,
					mid: mid!,
					pageNumber: pageParam,
					signal,
				}),
			),
		enabled: Number.isSafeInteger(seriesId) && seriesId > 0 && !!mid,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.archives?.length &&
			lastPage.page.num * lastPage.page.size < lastPage.page.total
				? lastPage.page.num + 1
				: undefined,
		staleTime: 5 * 60 * 1000,
	})
}

/**
 * 获取包含指定视频的收藏夹列表
 */
export const useGetFavoriteForOneVideo = (bvid: string, userMid?: number) => {
	const hasCookie = useHasCookie()
	const enabled = hasCookie && !!userMid && bvid.length > 0

	return useTracedQuery({
		span: { name: 'bilibili.favorite.for_video' },
		queryKey: favoriteListQueryKeys.favoriteForOneVideo(bvid, userMid),
		queryFn: ({ signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).getTargetVideoFavoriteStatus({
					userMid: userMid!,
					bvid,
					signal,
				}),
			),
		enabled,
		staleTime: 0,
		gcTime: 0,
	})
}

/**
 * 在所有收藏夹中搜索关键字
 */
export const useInfiniteSearchFavoriteItems = (
	scope: 'all' | 'this',
	keyword?: string,
	favoriteId?: number,
) => {
	const hasCookie = useHasCookie()

	const enabled =
		!!keyword && keyword.trim().length > 0 && hasCookie && !!favoriteId

	return useTracedInfiniteQuery({
		span: { name: 'bilibili.favorite.search_items' },
		queryKey: favoriteListQueryKeys.infiniteSearchFavoriteItems(
			scope,
			keyword,
			favoriteId,
		),
		queryFn: ({ pageParam, signal, span }) =>
			returnOrThrowAsync(
				bilibiliApi.withTrace(span).searchFavoriteListContents({
					favoriteId: favoriteId!,
					scope,
					pn: pageParam,
					keyword: keyword!,
					signal,
				}),
			),
		enabled,
		initialPageParam: 1,
		getNextPageParam: (lastPage, _allPages, lastPageParam) =>
			lastPage.has_more ? lastPageParam + 1 : undefined,
		staleTime: 1,
	})
}
