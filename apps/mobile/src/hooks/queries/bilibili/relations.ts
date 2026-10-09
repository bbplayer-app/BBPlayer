import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { BilibiliFollowingProfile } from '@/types/apis/bilibili'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

// Scope private relationship data by account, without putting credentials in query keys.
const sessionIds = new WeakMap<Record<string, string>, string>()
let nextSessionId = 0
export const useBilibiliRelationAccount = () =>
	useAppStore((state) => {
		const cookie = state.bilibiliCookie
		if (!cookie) return null
		if (cookie.DedeUserID) return cookie.DedeUserID
		// 用户手动设置 cookie 时可能不包含 uid，我们采用一个 in-memory 的自增 id
		let sessionId = sessionIds.get(cookie)
		if (!sessionId) {
			sessionId = `session:${++nextSessionId}`
			sessionIds.set(cookie, sessionId)
		}
		return sessionId
	})
export const relationQueryKeys = {
	relation: (account: string | null, mid: number) =>
		['bilibili', 'relations', account, mid] as const,
	followings: (account: string | null) =>
		['bilibili', 'followings', account] as const,
	groups: (account: string | null) =>
		[...relationQueryKeys.followings(account), 'groups'] as const,
	list: (account: string | null, tagId: number, keyword: string) =>
		[...relationQueryKeys.followings(account), 'list', tagId, keyword] as const,
}

export const useUserRelation = (mid: number) => {
	const account = useBilibiliRelationAccount()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	return useQuery({
		queryKey: relationQueryKeys.relation(account, mid),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getUserRelation({ mid, signal })),
		enabled: hasCookie && Number.isSafeInteger(mid) && mid > 0,
		staleTime: 0,
	})
}

export const useFollowingGroups = () => {
	const account = useBilibiliRelationAccount()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	return useQuery({
		queryKey: relationQueryKeys.groups(account),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getFollowingGroups({ signal })),
		enabled: hasCookie,
		staleTime: 0,
	})
}

interface FollowingPageData {
	list: BilibiliFollowingProfile[]
	total?: number
	nextPage?: number
}

export const useInfiniteFollowings = (
	keyword = '',
	tagId = -20,
	enabled = true,
) => {
	const account = useBilibiliRelationAccount()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	const search = keyword.trim()
	const activeTagId = search ? -20 : tagId
	return useInfiniteQuery({
		queryKey: relationQueryKeys.list(account, activeTagId, search),
		queryFn: async ({ pageParam, signal }): Promise<FollowingPageData> => {
			if (activeTagId !== -20) {
				const list = await returnOrThrowAsync(
					bilibiliApi.getFollowingGroupMembers({
						tagId: activeTagId,
						pn: pageParam,
						signal,
					}),
				)
				return {
					list,
					nextPage: list.length === 20 ? pageParam + 1 : undefined,
				}
			}
			const uid = useAppStore.getState().bilibiliCookie?.DedeUserID
			const mid = uid
				? Number(uid)
				: (await returnOrThrowAsync(bilibiliApi.getUserInfo({ signal }))).mid
			const response = await returnOrThrowAsync(
				search
					? bilibiliApi.searchFollowings({
							mid,
							keyword: search,
							pn: pageParam,
							signal,
						})
					: bilibiliApi.getFollowings({ mid, pn: pageParam, signal }),
			)
			return {
				list: response.list ?? [],
				total: response.total,
				nextPage:
					response.list?.length && pageParam * 50 < response.total
						? pageParam + 1
						: undefined,
			}
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) => lastPage.nextPage,
		enabled: hasCookie && enabled,
		staleTime: 0,
	})
}
