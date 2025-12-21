import FunctionalMenu from '@/components/common/FunctionalMenu'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { PlaylistLoading } from '@/features/playlist/remote/components/PlaylistLoading'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import renderToViewItem from '@/features/playlist/remote/toview/components/Item'
import {
	useClearToViewVideoList,
	useDeleteToViewVideo,
} from '@/hooks/mutations/bilibili/video'
import { useGetToViewVideoList } from '@/hooks/queries/bilibili/video'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { bv2av } from '@/lib/api/bilibili/utils'
import { AppRuntime } from '@/lib/effect/runtime'
import { syncFacade } from '@/lib/facades/sync'
import type { BilibiliToViewVideoList } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'
import { Effect } from 'effect'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Dimensions, RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, Menu, Portal, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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

const dimensions = Dimensions.get('window')

const handlePlay = (track: BilibiliTrack) => {
	const program = Effect.gen(function* () {
		yield* syncFacade.addTrackToLocal(track)

		yield* Effect.tryPromise(() =>
			addToQueue({
				tracks: [track],
				playNow: true,
				clearQueue: false,
				playNext: false,
			}),
		)
	}).pipe(
		Effect.catchAll((error) => {
			return Effect.sync(() => {
				toastAndLogError('将 track 录入本地失败', error, 'UI.Playlist.Remote')
				reportErrorToSentry(
					error,
					'将 track 录入本地失败',
					'UI.Playlist.Remote',
				)
			})
		}),
	)

	void AppRuntime.runPromise(program)
}

export default function ToViewPage() {
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const { colors } = useTheme()
	const [menuVisiable, setMenuVisiable] = useState(false)
	const insets = useSafeAreaInsets()

	const { selected, selectMode, toggle, enterSelectMode } = useTrackSelection()
	const openModal = useModalStore((state) => state.open)

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

	if (isToViewDataPending) {
		return <PlaylistLoading />
	}

	if (isToViewDataError) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={
						selectMode ? `已选择\u2009${selected.size}\u2009首` : '稍后再看'
					}
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
				<Appbar.Action
					icon='dots-vertical'
					onPress={() => setMenuVisiable(true)}
				/>
			</Appbar.Header>

			<View style={styles.listContainer}>
				<TrackList
					tracks={tracksData}
					playTrack={handlePlay}
					trackMenuItems={trackMenuItems}
					selectMode={selectMode}
					selected={selected}
					toggle={toggle}
					enterSelectMode={enterSelectMode}
					ListHeaderComponent={
						<PlaylistHeader
							coverUri={undefined}
							title={'稍后再看'}
							subtitles={`有\u2009${tracksData.length}\u2009首待播放的歌曲`}
							description={undefined}
							// onClickMainButton={handlePlayAll}
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
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- renderToViewItem 需要一个特化属性 progress，就用 any hack 一下
					renderCustomItem={renderToViewItem as any}
				/>
			</View>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>

			<Portal>
				<FunctionalMenu
					visible={menuVisiable}
					onDismiss={() => setMenuVisiable(false)}
					anchor={{
						x: dimensions.width - 10,
						y: 60 + insets.top,
					}}
				>
					<Menu.Item
						onPress={() => {
							setMenuVisiable(false)
							deleteToViewVideo({
								deleteAllViewed: true,
								avid: undefined,
							})
						}}
						title='清除所有已播放歌曲'
						leadingIcon='trash-can'
					/>
					<Menu.Item
						onPress={() => {
							setMenuVisiable(false)
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
						leadingIcon='delete'
						titleStyle={{ color: colors.error }}
					/>
				</FunctionalMenu>
			</Portal>
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
