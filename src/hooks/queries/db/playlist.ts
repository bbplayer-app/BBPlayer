import { queryClient } from '@/lib/config/queryClient'
import { playlistService } from '@/lib/services/playlistService'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import * as Sentry from '@sentry/react-native'
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
		queryFn: () =>
			Sentry.startSpan(
				{
					name: 'query:db:playlists:playlistLists',
					op: 'function',
				},
				async () => returnOrThrowAsync(playlistService.getAllPlaylists()),
			),
	})
}

export const usePlaylistContents = (playlistId: number) => {
	return useQuery({
		queryKey: playlistKeys.playlistAllContents(playlistId),
		queryFn: () =>
			Sentry.startSpan(
				{
					name: 'query:db:playlists:playlistAllContents',
					op: 'function',
				},
				async () =>
					returnOrThrowAsync(playlistService.getPlaylistTracks(playlistId)),
			),
	})
}

export const usePlaylistMetadata = (playlistId: number) => {
	return useQuery({
		queryKey: playlistKeys.playlistMetadata(playlistId),
		queryFn: () =>
			Sentry.startSpan(
				{
					name: 'query:db:playlists:playlistMetadata',
					op: 'function',
				},
				async () =>
					returnOrThrowAsync(playlistService.getPlaylistMetadata(playlistId)),
			),
	})
}

export const usePlaylistsContainingTrack = (uniqueKey: string | undefined) => {
	return useQuery({
		queryKey: ['playlistsContainingTrack', 'byUniqueKey', uniqueKey],
		queryFn:
			uniqueKey !== undefined
				? () =>
						Sentry.startSpan(
							{
								name: 'query:playlistsContainingTrack:byUniqueKey',
								op: 'function',
							},
							async () =>
								returnOrThrowAsync(
									playlistService.getLocalPlaylistsContainingTrackByUniqueKey(
										uniqueKey,
									),
								),
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
			Sentry.startSpan(
				{
					name: 'query:db:playlists:searchTracksInPlaylist',
					op: 'function',
				},
				async () =>
					returnOrThrowAsync(
						playlistService.searchTrackInPlaylist(playlistId, query),
					),
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
			Sentry.startSpan(
				{
					name: 'query:db:playlists:playlistContentsInfinite',
					op: 'function',
				},
				async () =>
					returnOrThrowAsync(
						playlistService.getPlaylistTracksPaginated({
							playlistId,
							limit,
							initialLimit,
							cursor: pageParam,
						}),
					),
			),
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		initialPageParam: undefined as
			| { lastOrder: number; createdAt: number; lastId: number }
			| undefined,
		gcTime: 0,
	})
}
