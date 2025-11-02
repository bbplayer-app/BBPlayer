import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { PlaylistLoading } from '@/features/playlist/remote/components/PlaylistLoading'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { useGetToViewVideoList } from '@/hooks/queries/bilibili/video'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { bv2av } from '@/lib/api/bilibili/utils'
import type { BilibiliToViewVideoList } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

const mapApiItemToTrack = (
	apiItem: BilibiliToViewVideoList['list'][0],
): BilibiliTrack => {
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
		trackDownloads: null,
	}
}

export default function ToViewPage() {
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const { colors } = useTheme()

	const { selected, selectMode, toggle, enterSelectMode } = useTrackSelection()
	const openModal = useModalStore((state) => state.open)
	const addToQueue = usePlayerStore((state) => state.addToQueue)

	const {
		data: rawToViewData,
		isPending: isToViewDataPending,
		isError: isToViewDataError,
		refetch,
	} = useGetToViewVideoList()

	const tracksData = useMemo(() => {
		if (!rawToViewData) {
			return []
		}
		return rawToViewData.list.map((item) => mapApiItemToTrack(item))
	}, [rawToViewData])

	const { playTrack } = useRemotePlaylist()

	const trackMenuItems = usePlaylistMenu(playTrack)

	const handlePlayAll = useCallback(
		(track?: BilibiliTrack) => {
			if (!tracksData.length) return
			void addToQueue({
				tracks: tracksData,
				playNow: true,
				clearQueue: true,
				startFromKey: track?.uniqueKey,
				playNext: false,
			})
		},
		[tracksData, addToQueue],
	)

	if (isToViewDataPending) {
		return <PlaylistLoading />
	}

	if (isToViewDataError) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={selectMode ? `已选择 ${selected.size} 首` : '稍后再看'}
				/>
				{selectMode ? (
					<Appbar.Action
						icon='playlist-plus'
						onPress={() => {
							const payloads = []
							for (const id of selected) {
								const track = tracksData.find((t) => t.id === id)
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

			<View
				style={{
					flex: 1,
				}}
			>
				<TrackList
					tracks={tracksData}
					playTrack={handlePlayAll}
					trackMenuItems={trackMenuItems}
					selectMode={selectMode}
					selected={selected}
					toggle={toggle}
					enterSelectMode={enterSelectMode}
					ListHeaderComponent={
						<PlaylistHeader
							coverUri={undefined}
							title={'稍后再看'}
							subtitles={`有 ${tracksData.length} 首待播放的歌曲`}
							description={undefined}
							onClickMainButton={handlePlayAll}
							mainButtonIcon={'play'}
							linkedPlaylistId={undefined}
							mainButtonText='播放全部'
							id={'稍后再看'}
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
				/>
			</View>
			<View
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
				}}
			>
				<NowPlayingBar />
			</View>
		</View>
	)
}
