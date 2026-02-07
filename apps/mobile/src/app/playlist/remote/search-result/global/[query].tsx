import { useLocalSearchParams, useRouter } from 'expo-router'
import { decode } from 'he'
import { useMemo, useEffect, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'

import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { useSearchInteractions } from '@/features/playlist/remote/search-result/hooks/useSearchInteractions'
import { PlaylistTrackListSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { useSearchResults } from '@/hooks/queries/bilibili/search'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { analyticsService } from '@/lib/services/analyticsService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { formatMMSSToSeconds } from '@/utils/time'

const mapApiItemToTrack = (apiItem: BilibiliSearchVideo): BilibiliTrack => {
	return {
		id: apiItem.aid,
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title.replace(/<em[^>]*>|<\/em>/g, ''),
		artist: {
			id: apiItem.mid,
			name: apiItem.author,
			remoteId: apiItem.mid.toString(),
			source: 'bilibili',
			createdAt: new Date(apiItem.senddate),
			updatedAt: new Date(apiItem.senddate),
		},
		coverUrl: `https:${apiItem.pic}`,
		duration: apiItem.duration ? formatMMSSToSeconds(apiItem.duration) : 0,
		createdAt: new Date(apiItem.senddate),
		updatedAt: new Date(apiItem.senddate),
		titleHtml: apiItem.title,
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

export default function SearchResultsPage() {
	const { colors } = useTheme()
	const { query } = useLocalSearchParams<{ query: string }>()
	const router = useRouter()

	const { selected, selectMode, toggle, enterSelectMode } = useTrackSelection()
	const selection = useMemo(
		() => ({
			active: selectMode,
			selected,
			toggle,
			enter: enterSelectMode,
		}),
		[selectMode, selected, toggle, enterSelectMode],
	)
	const [refreshing, setRefreshing] = useState(false)
	const openModal = useModalStore((state) => state.open)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop<BilibiliTrack>()

	const {
		data: searchData,
		isPending: isPendingSearchData,
		isError: isErrorSearchData,
		hasNextPage,
		refetch,
		fetchNextPage,
	} = useSearchResults(query)

	useEffect(() => {
		if (query) {
			void analyticsService.logSearch('global')
		}
	}, [query])

	const { trackMenuItems, playTrack } = useSearchInteractions()

	const uniqueSearchData = useMemo(() => {
		if (!searchData?.pages) {
			return []
		}

		const allTracks = searchData.pages.flatMap((page) => page.result)
		const uniqueMap = new Map(
			allTracks.map((track) => [
				track.bvid,
				{
					...track,
					title: decode(track.title),
				},
			]),
		)
		const uniqueTracks = [...uniqueMap.values()]
		return uniqueTracks.map(mapApiItemToTrack)
	}, [searchData])

	if (isPendingSearchData) {
		return <PlaylistTrackListSkeleton />
	}

	if (isErrorSearchData) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={
						selectMode
							? `已选择\u2009${selected.size}\u2009首`
							: `搜索结果\u2009-\u2009${query}`
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<Appbar.Action
						icon='playlist-plus'
						onPress={() => {
							const payloads = []
							for (const id of selected) {
								const track = uniqueSearchData.find((t) => t.id === id)
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
				) : (
					<Appbar.BackAction onPress={() => router.back()} />
				)}
			</Appbar.Header>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={uniqueSearchData ?? []}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					hasNextPage={hasNextPage}
					ListHeaderComponent={null}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true)
								await refetch()
								setRefreshing(false)
							}}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					ListEmptyComponent={
						<Text
							style={[styles.emptyListText, { color: colors.onSurfaceVariant }]}
						>
							没有找到与&thinsp;&ldquo;{query}&rdquo;&thinsp;相关的内容
						</Text>
					}
				/>
			</View>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
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
	emptyListText: {
		paddingVertical: 32,
		textAlign: 'center',
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
