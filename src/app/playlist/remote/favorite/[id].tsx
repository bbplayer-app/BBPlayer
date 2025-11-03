import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { PlaylistLoading } from '@/features/playlist/remote/components/PlaylistLoading'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import useCheckLinkedToPlaylist from '@/features/playlist/remote/hooks/useCheckLinkedToLocalPlaylist'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { usePlaylistSync } from '@/hooks/mutations/db/playlist'
import { useInfiniteFavoriteList } from '@/hooks/queries/bilibili/favorite'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { bv2av } from '@/lib/api/bilibili/utils'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import toast from '@/utils/toast'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

const mapApiItemToTrack = (
	apiItem: BilibiliFavoriteListContent,
): BilibiliTrack => {
	return {
		id: bv2av(apiItem.bvid),
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title,
		artist: {
			id: apiItem.upper.mid,
			name: apiItem.upper.name,
			remoteId: apiItem.upper.mid.toString(),
			source: 'bilibili',
			avatarUrl: apiItem.upper.face,
			createdAt: new Date(apiItem.pubdate),
			updatedAt: new Date(apiItem.pubdate),
		},
		coverUrl: apiItem.cover,
		duration: apiItem.duration,
		createdAt: new Date(apiItem.pubdate),
		updatedAt: new Date(apiItem.pubdate),
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
		trackDownloads: null,
	}
}

export default function FavoritePage() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { colors } = useTheme()
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const linkedPlaylistId = useCheckLinkedToPlaylist(Number(id), 'favorite')

	const { selected, selectMode, toggle, enterSelectMode } = useTrackSelection()
	const openModal = useModalStore((state) => state.open)

	const {
		data: favoriteData,
		isPending: isFavoriteDataPending,
		isError: isFavoriteDataError,
		fetchNextPage,
		refetch,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteFavoriteList(Number(id))
	const tracks = useMemo(() => {
		return (
			favoriteData?.pages
				.flatMap((page) => page.medias ?? [])
				.map(mapApiItemToTrack) ?? []
		)
	}, [favoriteData])

	const { mutate: syncFavorite } = usePlaylistSync()

	const { playTrack } = useRemotePlaylist()

	const trackMenuItems = usePlaylistMenu(playTrack)

	const handleSync = useCallback(() => {
		if (favoriteData?.pages.flatMap((page) => page.medias).length === 0) {
			toast.info('收藏夹为空，无需同步')
			return
		}
		toast.show('同步中...')
		setRefreshing(true)
		syncFavorite(
			{
				remoteSyncId: Number(id),
				type: 'favorite',
			},
			{
				onSuccess: (id) => {
					if (!id) return
					router.replace({
						pathname: '/playlist/local/[id]',
						params: { id: String(id) },
					})
				},
			},
		)
		setRefreshing(false)
	}, [favoriteData?.pages, id, router, syncFavorite])

	useEffect(() => {
		if (typeof id !== 'string') {
			router.replace('/+not-found')
		}
	}, [id, router])

	if (typeof id !== 'string') {
		return null
	}

	if (isFavoriteDataPending) {
		return <PlaylistLoading />
	}

	if (isFavoriteDataError) {
		return (
			<PlaylistError
				text='加载收藏夹内容失败'
				onRetry={refetch}
			/>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={
						selectMode
							? `已选择 ${selected.size} 首`
							: favoriteData.pages[0].info.title
					}
				/>
				{selectMode ? (
					<Appbar.Action
						icon='playlist-plus'
						onPress={() => {
							const payloads = []
							for (const id of selected) {
								const track = tracks.find((t) => t.id === id)
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
					tracks={tracks}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selectMode={selectMode}
					selected={selected}
					toggle={toggle}
					enterSelectMode={enterSelectMode}
					ListHeaderComponent={
						<PlaylistHeader
							coverUri={favoriteData.pages[0].info.cover}
							title={favoriteData.pages[0].info.title}
							subtitles={`${favoriteData.pages[0].info.upper.name} • ${favoriteData.pages[0].info.media_count} 首歌曲`}
							description={favoriteData.pages[0].info.intro}
							onClickMainButton={handleSync}
							mainButtonIcon={'sync'}
							linkedPlaylistId={linkedPlaylistId}
							id={id}
						/>
					}
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
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					isFetchingNextPage={isFetchingNextPage}
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
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
