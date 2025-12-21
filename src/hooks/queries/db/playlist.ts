import { queryClient } from '@/lib/config/queryClient'
import { playlistService } from '@/lib/services/playlistService'
import { effectToPromise } from '@/utils/effect'
import {
	keepPreviousData,
	skipToken,
	useInfiniteQuery,
	useQuery,
} from '@tanstack/react-query'

queryClient.setQueryDefaults(['db', 'playlists'], {
	retry: false,
	staleTime: 0,
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
	searchTracksInPlaylist: (playlistId: number, query: string) =>
		[...playlistKeys.all, 'searchTracksInPlaylist', playlistId, query] as const,
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
}

export const usePlaylistLists = () => {
	return useQuery({
		queryKey: playlistKeys.playlistLists(),
		queryFn: () => effectToPromise(playlistService.getAllPlaylists()),
	})
}

export const usePlaylistContents = (playlistId: number) => {
	return useQuery({
		queryKey: playlistKeys.playlistAllContents(playlistId),
		queryFn: () =>
			effectToPromise(playlistService.getPlaylistTracks(playlistId)),
	})
}

export const usePlaylistMetadata = (playlistId: number) => {
	return useQuery({
		queryKey: playlistKeys.playlistMetadata(playlistId),
		queryFn: () =>
			effectToPromise(playlistService.getPlaylistMetadata(playlistId), true),
	})
}

export const usePlaylistsContainingTrack = (uniqueKey: string | undefined) => {
	return useQuery({
		queryKey: ['playlistsContainingTrack', 'byUniqueKey', uniqueKey],
		queryFn:
			uniqueKey !== undefined
				? () =>
						effectToPromise(
							playlistService.getLocalPlaylistsContainingTrackByUniqueKey(
								uniqueKey,
							),
							true,
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
			effectToPromise(
				playlistService.searchTrackInPlaylist(playlistId, query),
				true,
			),
		enabled: !!query.trim() && startSearch,
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
		queryFn: ({ pageParam }) =>
			effectToPromise(
				playlistService.getPlaylistTracksPaginated({
					playlistId,
					limit,
					initialLimit,
					cursor: pageParam,
				}),
				true,
			),
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		initialPageParam: undefined as
			| { lastOrder: number; createdAt: number; lastId: number }
			| undefined,
		gcTime: 0,
	})
}
