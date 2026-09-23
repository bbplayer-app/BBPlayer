import {
	keepPreviousData,
	skipToken,
	useInfiniteQuery,
	useQuery,
} from '@tanstack/react-query'

import useAppStore from '@/hooks/stores/useAppStore'
import { queryClient } from '@/lib/config/queryClient'
import { ServiceError } from '@/lib/errors'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import { playlistService } from '@/lib/services/playlistService'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

queryClient.setQueryDefaults(['db', 'playlists'], {
	retry: false,
	staleTime: 0,
	networkMode: 'always',
})

export const playlistKeys = {
	all: ['db', 'playlists'] as const,
	playlistLists: () => [...playlistKeys.all, 'playlistLists'] as const,
	playlistContents: (playlistId: number) =>
		[...playlistKeys.all, 'playlistContents', playlistId] as const,
	playlistAllContents: (playlistId: number) =>
		[...playlistKeys.playlistContents(playlistId), 'all'] as const,
	playlistMetadata: (playlistId: number) =>
		[...playlistKeys.all, 'playlistMetadata', playlistId] as const,
	playlistsContainingTrack: (id: number | string | undefined) =>
		[...playlistKeys.all, 'playlistsContainingTrack', id] as const,
	allPlaylistsContainingTrack: (id: number | string | undefined) =>
		[...playlistKeys.all, 'allPlaylistsContainingTrack', id] as const,
	searchTracksInPlaylist: (playlistId: number, query: string) =>
		[...playlistKeys.all, 'searchTracksInPlaylist', playlistId, query] as const,
	searchPlaylists: (query: string) =>
		[...playlistKeys.all, 'searchPlaylists', query] as const,
	playlistContentsInfinite: (
		playlistId: number,
		limit: number,
		initialLimit?: number,
	) =>
		[
			...playlistKeys.playlistContents(playlistId),
			'infinite',
			limit,
			initialLimit,
		] as const,
	editorInviteCode: (shareId: string) =>
		[...playlistKeys.all, 'editorInviteCode', shareId] as const,
	playlistByShareId: (shareId: string) =>
		[...playlistKeys.all, 'byShareId', shareId] as const,
}

export const usePlaylistLists = () => {
	return useQuery({
		queryKey: playlistKeys.playlistLists(),
		queryFn: () => returnOrThrowAsync(playlistService.getAllPlaylists()),
	})
}

export const usePlaylistContents = (playlistId: number) => {
	return useQuery({
		queryKey: playlistKeys.playlistAllContents(playlistId),
		queryFn: () =>
			returnOrThrowAsync(playlistService.getPlaylistTracks(playlistId)),
	})
}

export const usePlaylistMetadata = (playlistId: number) => {
	return useQuery({
		queryKey: playlistKeys.playlistMetadata(playlistId),
		queryFn: async () => {
			const result = await playlistService.getPlaylistMetadata(playlistId)
			if (result.isErr()) throw result.error
			// service 在歌单不存在时返回 undefined，而 React Query 不接受 queryFn
			// 返回 undefined（会抛错），因此统一转成 null，交由页面按「不存在」处理
			return result.value ?? null
		},
	})
}

export const usePlaylistsContainingTrack = (uniqueKey: string | undefined) => {
	return useQuery({
		queryKey: playlistKeys.playlistsContainingTrack(uniqueKey),
		queryFn:
			uniqueKey !== undefined
				? () =>
						returnOrThrowAsync(
							playlistService.getLocalPlaylistsContainingTrackByUniqueKey(
								uniqueKey,
							),
						)
				: skipToken,
		enabled: uniqueKey !== undefined,
	})
}

export const useAllPlaylistsContainingTrack = (
	uniqueKey: string | undefined,
) => {
	return useQuery({
		queryKey: playlistKeys.allPlaylistsContainingTrack(uniqueKey),
		queryFn:
			uniqueKey !== undefined
				? () =>
						returnOrThrowAsync(
							playlistService.getPlaylistsContainingTrackByUniqueKey(uniqueKey),
						)
				: skipToken,
		enabled: uniqueKey !== undefined,
	})
}

export const useSearchTracksInPlaylist = (
	playlistId: number,
	query: string,
	startSearch: boolean,
) => {
	return useQuery({
		queryKey: playlistKeys.searchTracksInPlaylist(playlistId, query),
		queryFn: () =>
			returnOrThrowAsync(
				playlistService.searchTrackInPlaylist(playlistId, query),
			),
		enabled: !!query.trim() && startSearch,
		placeholderData: keepPreviousData,
	})
}

export const useSearchPlaylists = (query: string, enabled: boolean) => {
	return useQuery({
		queryKey: playlistKeys.searchPlaylists(query),
		queryFn: () => returnOrThrowAsync(playlistService.searchPlaylists(query)),
		enabled: enabled && !!query.trim(),
		placeholderData: keepPreviousData,
	})
}

export const usePlaylistContentsInfinite = (
	playlistId: number,
	limit: number,
	initialLimit?: number,
) => {
	return useInfiniteQuery({
		queryKey: playlistKeys.playlistContentsInfinite(
			playlistId,
			limit,
			initialLimit,
		),
		queryFn: async ({ pageParam }) => {
			const result = await playlistService.getPlaylistTracksPaginated({
				playlistId,
				limit,
				initialLimit,
				cursor: pageParam,
			})
			if (result.isErr()) {
				// 歌单在查询发起后被删除（例如删除后页面尚未卸载时又触发了重取）
				// 属于预期内的竞态，这里按空歌单处理，不作为错误上报
				if (
					result.error instanceof ServiceError &&
					result.error.type === 'PlaylistNotFound'
				) {
					return { tracks: [], sortKeys: [], nextCursor: undefined }
				}
				throw result.error
			}
			return result.value
		},
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		initialPageParam: undefined as
			| { lastSortKey: string; createdAt: number; lastId: number }
			| undefined,
		gcTime: 0,
	})
}

export const usePlaylistByShareId = (shareId?: string) => {
	return useQuery({
		queryKey: playlistKeys.playlistByShareId(shareId ?? ''),
		queryFn: shareId
			? () => returnOrThrowAsync(playlistService.findPlaylistByShareId(shareId))
			: skipToken,
		enabled: !!shareId,
	})
}

export const useEditorInviteCode = (shareId?: string | null) => {
	const hasToken = useAppStore((state) => !!state.bbplayerToken)
	const enabled = !!shareId && hasToken
	return useQuery({
		queryKey: playlistKeys.editorInviteCode(shareId ?? ''),
		queryFn: enabled
			? () =>
					returnOrThrowAsync(sharedPlaylistFacade.getEditorInviteCode(shareId))
			: skipToken,
		select: (result) => result.editorInviteCode ?? null,
		enabled,
	})
}
