import { Icon } from '@expo/ui'
import { useImage } from 'expo-image'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import renderToViewItem from '@/features/playlist/remote/toview/components/Item'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import {
	useClearToViewVideoList,
	useDeleteToViewVideo,
} from '@/hooks/mutations/bilibili/video'
import { useGetToViewVideoList } from '@/hooks/queries/bilibili/video'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { bv2av } from '@/lib/api/bilibili/utils'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import type { BilibiliToViewVideoList } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

const DELETE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const mapApiItemToTrack = (
	apiItem: BilibiliToViewVideoList['list'][0],
): BilibiliTrack & { progress: number } => {
	return {
		id: bv2av(apiItem.bvid),
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title,
		artist: {
			id: apiItem.owner.mid,
			name: apiItem.owner.name,
			remoteId: apiItem.owner.mid.toString(),
			source: 'bilibili',
			avatarUrl: apiItem.owner.face,
			createdAt: new Date(apiItem.pubdate),
			updatedAt: new Date(apiItem.pubdate),
		},
		coverUrl: apiItem.pic,
		duration: apiItem.duration,
		createdAt: new Date(apiItem.pubdate),
		updatedAt: new Date(apiItem.pubdate),
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: apiItem.cid,
			isMultiPage: false,
			videoIsValid: true,
		},
		progress: apiItem.progress,
	}
}

export default function ToViewPage() {
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const theme = useTheme()
	const { colors } = theme

	const coverRef = useImage('', {
		onError: () => void 0,
	})
	const {
		backgroundColor,
		nowPlayingBarColor,
		primaryButtonColor,
		primaryButtonTextColor,
		secondaryButtonContainerColor,
		secondaryButtonIconColor,
	} = usePlaylistBackgroundColor(coverRef, theme.dark, colors.background)

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
	const openModal = useModalStore((state) => state.open)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop<BilibiliTrack>()

	const {
		data: rawToViewData,
		isPending: isToViewDataPending,
		isError: isToViewDataError,
		refetch,
	} = useGetToViewVideoList()
	const { mutate: deleteToViewVideo } = useDeleteToViewVideo()
	const { mutate: clearToViewVideoList } = useClearToViewVideoList()

	const tracksData = useMemo(() => {
		if (!rawToViewData) {
			return []
		}
		return rawToViewData.list.map((item) => mapApiItemToTrack(item))
	}, [rawToViewData])

	const { playTrack } = useRemotePlaylist()

	const trackMenuItems = usePlaylistMenu(playTrack)

	const handlePlay = useCallback(async (track: BilibiliTrack) => {
		const createIt = await syncFacade.addTrackToLocal(track)
		if (createIt.isErr()) {
			toastAndLogError(
				'将 track 录入本地失败',
				createIt.error,
				'UI.Playlist.Remote',
			)
			reportErrorToSentry(
				createIt.error,
				'将 track 录入本地失败',
				'UI.Playlist.Remote',
			)
			return
		}
		void addToQueue({
			tracks: [track],
			playNow: true,
			clearQueue: false,
			startFromKey: track.uniqueKey,
			playNext: false,
		})
	}, [])

	const handlePlayAll = useCallback(async () => {
		if (!tracksData || tracksData.length === 0) {
			toast.error('没有可播放的歌曲')
			return
		}

		await addToQueue({
			tracks: tracksData,
			playNow: true,
			clearQueue: true,
			playNext: false,
		})
	}, [tracksData])

	if (isToViewDataPending) {
		return <PlaylistPageSkeleton />
	}

	if (isToViewDataError) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.Content
					title={
						selectMode ? `已选择\u2009${selected.size}\u2009首` : '稍后再看'
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							icon='select-all'
							onPress={() => setSelected(new Set(tracksData.map((t) => t.id)))}
						/>
						<Appbar.Action
							icon='select-compare'
							onPress={() =>
								setSelected(
									new Set(
										tracksData
											.filter((t) => !selected.has(t.id))
											.map((t) => t.id),
									),
								)
							}
						/>
						<Appbar.Action
							icon='playlist-plus'
							onPress={() => {
								const trackMap = new Map(tracksData.map((t) => [t.id, t]))
								const payloads = []
								for (const id of selected) {
									const track = trackMap.get(id)
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
				<FunctionalMenu anchor={<Appbar.Action icon='dots-vertical' />}>
					<FunctionalMenu.Item
						onPress={() => {
							deleteToViewVideo({
								deleteAllViewed: true,
								avid: undefined,
							})
						}}
						title='清除所有已播放歌曲'
						leadingIcon={DELETE_ICON}
					/>
					<FunctionalMenu.Item
						onPress={() => {
							alert(
								'清除所有稍后再看歌曲',
								'确定要清除所有稍后再看的歌曲吗？',
								[
									{
										text: '取消',
									},
									{
										text: '确定',
										onPress: () => {
											clearToViewVideoList()
										},
									},
								],
								{ cancelable: true },
							)
						}}
						title='清除所有歌曲'
						leadingIcon={DELETE_ICON}
						titleStyle={{ color: colors.error }}
					/>
				</FunctionalMenu>
			</Appbar.Header>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={tracksData}
					playTrack={handlePlay}
					trackMenuItems={trackMenuItems}
					selection={selection}
					ListHeaderComponent={
						<PlaylistHeader
							cover={coverRef ?? undefined}
							title={'稍后再看'}
							subtitles={`有\u2009${tracksData.length}\u2009首待播放的歌曲`}
							description={undefined}
							onClickMainButton={handlePlayAll}
							mainButtonIcon={'play'}
							linkedPlaylistId={undefined}
							mainButtonText='播放全部'
							id={'稍后再看'}
							primaryButtonColor={primaryButtonColor}
							primaryButtonTextColor={primaryButtonTextColor}
							secondaryButtonContainerColor={secondaryButtonContainerColor}
							secondaryButtonIconColor={secondaryButtonIconColor}
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
					// oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- renderToViewItem 需要一个特化属性 progress，就用 any hack 一下
					renderCustomItem={renderToViewItem as any}
				/>
			</View>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar backgroundColor={nowPlayingBarColor} />
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
