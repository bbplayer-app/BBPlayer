import { useImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, Button, useTheme } from 'react-native-paper'

import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import useCheckLinkedToPlaylist from '@/features/playlist/remote/hooks/useCheckLinkedToLocalPlaylist'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import {
	favoriteListQueryKeys,
	useInfiniteSeriesArchives,
	useSeriesMetadata,
} from '@/hooks/queries/bilibili/favorite'
import { useOtherUserInfo } from '@/hooks/queries/bilibili/user'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { queryClient } from '@/lib/config/queryClient'
import type { BilibiliSeriesArchives } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'

const mapApiItemToTrack = (
	apiItem: NonNullable<BilibiliSeriesArchives['archives']>[number],
	artistName: string,
): BilibiliTrack => {
	return {
		id: apiItem.aid,
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title,
		artist: {
			id: apiItem.upMid,
			name: artistName,
			remoteId: apiItem.upMid.toString(),
			source: 'bilibili',
			createdAt: new Date(apiItem.pubdate * 1000),
			updatedAt: new Date(apiItem.pubdate * 1000),
		},
		coverUrl: apiItem.pic,
		duration: apiItem.duration,
		createdAt: new Date(apiItem.pubdate * 1000),
		updatedAt: new Date(apiItem.pubdate * 1000),
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

export default function SeriesPage() {
	const isListReady = useScreenTransitionReady()
	const router = useRouter()
	const { id } = useLocalSearchParams<{ id: string }>()
	const theme = useTheme()
	const { colors } = theme
	const [refreshing, setRefreshing] = useState(false)
	const linkedPlaylistId = useCheckLinkedToPlaylist(Number(id), 'series')

	const { selected, selectMode, toggle, enterSelectMode, setSelected } =
		useTrackSelection()
	const selection = useMemo(
		() => ({
			active: selectMode,
			selected,
			toggle,
			enter: enterSelectMode,
		}),
		[selectMode, selected, toggle, enterSelectMode],
	)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()

	const seriesId = Number(id)
	const {
		data: seriesMetadata,
		isPending: isMetadataPending,
		isError: isMetadataError,
		refetch: refetchMetadata,
	} = useSeriesMetadata(seriesId)
	const {
		data: archivesData,
		isPending: isArchivesPending,
		isError: isArchivesError,
		isFetchingNextPage,
		isFetchNextPageError,
		hasNextPage,
		fetchNextPage,
		refetch: refetchArchives,
	} = useInfiniteSeriesArchives(seriesId, seriesMetadata?.mid)
	const { data: uploader } = useOtherUserInfo(seriesMetadata?.mid ?? 0, false)
	const artistName = uploader?.name ?? `UP主 ${seriesMetadata?.mid ?? ''}`
	const tracks = useMemo(
		() =>
			archivesData?.pages.flatMap((page) =>
				(page.archives ?? []).map((archive) =>
					mapApiItemToTrack(archive, artistName),
				),
			) ?? [],
		[archivesData, artistName],
	)

	const coverRef = useImage(
		resolveBilibiliImageUrl(archivesData?.pages[0]?.archives?.[0]?.pic) ?? '',
		{
			onError: () => void 0,
		},
	)
	const {
		backgroundColor,
		primaryButtonColor,
		primaryButtonTextColor,
		secondaryButtonContainerColor,
		secondaryButtonIconColor,
	} = usePlaylistBackgroundColor(coverRef, theme.dark, colors.background)

	const { playTrack } = useRemotePlaylist()
	const openModal = useModalStore((state) => state.open)

	const trackMenuItems = usePlaylistMenu(playTrack)

	const handleSync = useCallback(() => {
		openModal(
			'PlaylistSyncProgress',
			{
				remoteId: Number(id),
				type: 'series',
				shouldRedirectToLocalPlaylist: true,
			},
			{ dismissible: false },
		)
	}, [id, openModal])

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		await listRef.current?.scrollToOffset({ offset: 0, animated: false })
		queryClient.setQueryData(
			favoriteListQueryKeys.seriesArchives(seriesId, seriesMetadata?.mid),
			(old: typeof archivesData) =>
				old
					? {
							pages: old.pages.slice(0, 1),
							pageParams: old.pageParams.slice(0, 1),
						}
					: old,
		)
		await Promise.all([refetchMetadata(), refetchArchives()])
		setRefreshing(false)
	}, [listRef, refetchArchives, refetchMetadata, seriesId, seriesMetadata?.mid])

	useEffect(() => {
		if (
			typeof id !== 'string' ||
			!Number.isSafeInteger(seriesId) ||
			seriesId <= 0
		) {
			router.replace('/+not-found')
		}
	}, [id, router, seriesId])

	if (
		typeof id !== 'string' ||
		!Number.isSafeInteger(seriesId) ||
		seriesId <= 0
	) {
		return null
	}

	if (isMetadataPending || isArchivesPending || !isListReady) {
		return <PlaylistPageSkeleton animate={isListReady} />
	}

	if (isMetadataError || (isArchivesError && !archivesData)) {
		return (
			<PlaylistError
				text='加载系列内容失败'
				onRetry={() => {
					void refetchMetadata()
					void refetchArchives()
				}}
			/>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.Content
					title={
						selectMode
							? `已选择\u2009${selected.size}\u2009首`
							: seriesMetadata.name
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							icon='select-all'
							onPress={() => setSelected(new Set(tracks.map((t) => t.id)))}
						/>
						<Appbar.Action
							icon='select-compare'
							onPress={() =>
								setSelected(
									new Set(
										tracks.filter((t) => !selected.has(t.id)).map((t) => t.id),
									),
								)
							}
						/>
						<Appbar.Action
							icon='playlist-plus'
							onPress={() => {
								const payloads = []
								for (const selectedId of selected) {
									const track = tracks.find((t) => t.id === selectedId)
									if (track) {
										payloads.push({
											track: track as Track,
											artist: track.artist!,
										})
									}
								}
								openModal('BatchAddTracksToLocalPlaylist', {
									payloads,
								})
							}}
						/>
					</>
				) : (
					<Appbar.BackAction onPress={() => router.back()} />
				)}
			</Appbar.Header>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={tracks}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					isFetchingNextPage={isFetchingNextPage}
					hasNextPage={hasNextPage && !isFetchNextPageError}
					{...(isFetchNextPageError
						? {
								ListFooterComponent: (
									<Button onPress={() => void fetchNextPage()}>
										重试加载更多
									</Button>
								),
							}
						: {})}
					onEndReached={
						hasNextPage &&
						!refreshing &&
						!isFetchingNextPage &&
						!isFetchNextPageError
							? () => void fetchNextPage()
							: undefined
					}
					onEndReachedThreshold={0.5}
					ListHeaderComponent={
						<PlaylistHeader
							cover={coverRef ?? undefined}
							title={seriesMetadata.name}
							subtitles={`${artistName}\u2009•\u2009${seriesMetadata.total}\u2009首歌曲`}
							description={seriesMetadata.description}
							onClickMainButton={handleSync}
							mainButtonIcon={'sync'}
							linkedPlaylistId={linkedPlaylistId}
							id={id}
							primaryButtonColor={primaryButtonColor}
							primaryButtonTextColor={primaryButtonTextColor}
							secondaryButtonContainerColor={secondaryButtonContainerColor}
							secondaryButtonIconColor={secondaryButtonIconColor}
						/>
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => void handleRefresh()}
							colors={[colors.primary]}
						/>
					}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContainer: {
		flex: 1,
	},
})
