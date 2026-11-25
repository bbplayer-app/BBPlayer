import {
	Orpheus,
	PlaybackState,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import type { LegendListRef } from '@legendapp/list/react-native'
import { useImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

import PlaylistDetailLayout from '@/components/layout/PlaylistDetailLayout'
import { FlashingTrackListItem } from '@/features/playlist/remote/components/FlashingTrackListItem'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import type { ExtraData } from '@/features/playlist/remote/components/RemoteTrackList'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import useCheckLinkedToPlaylist from '@/features/playlist/remote/hooks/useCheckLinkedToLocalPlaylist'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { findResumePartIndex } from '@/features/playlist/remote/resumePart'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { usePlaylistSync } from '@/hooks/mutations/db/playlist'
import { useCurrentTrackId } from '@/hooks/player/useCurrentTrackId'
import {
	useGetMultiPageList,
	useGetVideoDetails,
} from '@/hooks/queries/bilibili/video'
import { useLastPlayRecordOfVideo } from '@/hooks/queries/db/track'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { useSettledValue } from '@/hooks/utils/useSettledValue'
import { bv2av } from '@/lib/api/bilibili/utils'
import type {
	BilibiliMultipageVideo,
	BilibiliVideoDetails,
} from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import * as Haptics from '@/utils/haptics'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import toast from '@/utils/toast'

const mapApiItemToTrack = (
	mp: BilibiliMultipageVideo,
	video: BilibiliVideoDetails,
): BilibiliTrack => {
	return {
		id: mp.cid,
		uniqueKey: `bilibili::${video.bvid}::${mp.cid}`,
		source: 'bilibili',
		title: mp.part,
		artist: {
			id: video.owner.mid,
			name: video.owner.name,
			remoteId: video.owner.mid.toString(),
			source: 'bilibili',
			createdAt: new Date(video.pubdate),
			updatedAt: new Date(video.pubdate),
		},
		coverUrl: video.pic,
		duration: mp.duration,
		createdAt: new Date(video.pubdate),
		updatedAt: new Date(video.pubdate),
		bilibiliMetadata: {
			bvid: video.bvid,
			cid: mp.cid,
			isMultiPage: true,
			videoIsValid: true,
			mainTrackTitle: video.title,
		},
	}
}

export default function MultipagePage() {
	const isListReady = useScreenTransitionReady()
	const router = useRouter()
	const { bvid, cid } = useLocalSearchParams<{ bvid: string; cid?: string }>()
	const [refreshing, setRefreshing] = useState(false)
	const theme = useTheme()
	const { colors } = theme
	const linkedPlaylistId = useCheckLinkedToPlaylist(bv2av(bvid), 'multi_page')

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

	const {
		data: rawMultipageData,
		isPending: isMultipageDataPending,
		isError: isMultipageDataError,
		refetch,
	} = useGetMultiPageList(bvid)

	const {
		data: videoData,
		isError: isVideoDataError,
		isPending: isVideoDataPending,
	} = useGetVideoDetails(bvid)

	const tracksData = useMemo(() => {
		if (!rawMultipageData || !videoData) {
			return []
		}

		return rawMultipageData.map((item) => mapApiItemToTrack(item, videoData))
	}, [rawMultipageData, videoData])

	const coverRef = useImage(resolveBilibiliImageUrl(videoData?.pic) ?? '', {
		onError: () => void 0,
	})

	const {
		backgroundColor,
		primaryButtonColor,
		primaryButtonTextColor,
		secondaryButtonContainerColor,
		secondaryButtonIconColor,
	} = usePlaylistBackgroundColor(coverRef, theme.dark, colors.background)

	const { mutate: syncMultipage } = usePlaylistSync()

	const { playTrack } = useRemotePlaylist()
	const listRef = useRef<LegendListRef>(null)
	const { handleDoubleTap } = useDoubleTapScrollToTop(listRef)

	const currentTrackId = useCurrentTrackId()
	const isPlaying = useIsPlaying()
	const playbackState = usePlaybackState()
	const { data: lastPlayRecord } = useLastPlayRecordOfVideo(bvid)

	const resumeIndex = findResumePartIndex(
		tracksData,
		currentTrackId,
		lastPlayRecord,
	)

	const resumePart = resumeIndex === -1 ? undefined : tracksData[resumeIndex]

	// 续播的目标就是当前曲目、并且正在放时不需要续播；切换曲目和取音频地址时报告的是缓冲，
	// 也算正在放。放着别的歌时照样显示，点了就切回这个视频
	const listeningHere =
		resumePart !== undefined &&
		resumePart.uniqueKey === currentTrackId &&
		(isPlaying || playbackState === PlaybackState.BUFFERING)

	// 切换曲目时当前曲目和播放状态会连着变好几次，按钮内容稳定一会儿再显示，免得闪一下
	const resumeButtonText = useSettledValue(
		resumePart !== undefined && !listeningHere
			? `续播 P${resumeIndex + 1}`
			: undefined,
	)

	const handleResume = useCallback(() => {
		if (!resumePart) return

		// 播放器里暂停着的就是这一 P：接着放，不再加进队列
		if (resumePart.uniqueKey === currentTrackId) {
			void Orpheus.play()

			return
		}

		void playTrack(resumePart)
		// 和从播放器跳过来时一样，滚到这一 P 并闪一下
		router.setParams({ cid: String(resumePart.id) })
	}, [resumePart, currentTrackId, playTrack, router])

	const trackMenuItems = usePlaylistMenu(playTrack)

	const handleSync = useCallback(() => {
		const toastId = 'sync-playlist'
		toast.show('同步中...', { id: toastId, duration: Infinity })
		setRefreshing(true)
		syncMultipage(
			{
				remoteSyncId: bv2av(bvid),
				type: 'multi_page',
				toastId,
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
	}, [bvid, router, syncMultipage])

	useEffect(() => {
		if (isListReady && tracksData.length > 0 && cid) {
			const index = tracksData.findIndex((track) => String(track.id) === cid)

			if (index !== -1) {
				// 给一点延时给列表渲染
				const timer = setTimeout(() => {
					void listRef.current?.scrollToIndex({
						index,
						animated: true,
						viewPosition: 0.5,
					})
				}, 500)

				return () => {
					clearTimeout(timer)
				}
			}
		}
	}, [cid, tracksData, isListReady])

	const renderCustomItem = useCallback(
		({
			item,
			index,
			extraData,
		}: ListRenderItemInfoWithExtraData<BilibiliTrack, ExtraData>) => {
			if (!extraData) throw new Error('Extradata 不存在')

			const {
				playTrack: play,
				trackMenuItems: _trackMenuItems,
				selection: _selection,
				showItemCover,
			} = extraData

			const shouldFlash = String(item.id) === cid

			return (
				<FlashingTrackListItem
					shouldFlash={shouldFlash}
					index={index}
					onTrackPress={() => play(item)}
					menuItems={_trackMenuItems(item)}
					showCoverImage={showItemCover ?? true}
					data={{
						cover: item.coverUrl ?? undefined,
						title: item.title,
						duration: item.duration,
						id: item.id,
						artistName: item.artist?.name,
						uniqueKey: item.uniqueKey,
						titleHtml: item.titleHtml,
					}}
					toggleSelected={() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
						selection.toggle(item.id)
					}}
					isSelected={selection.selected.has(item.id)}
					selectMode={selection.active}
					enterSelectMode={() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
						selection.enter(item.id)
					}}
				/>
			)
		},
		[cid, selection],
	)

	useEffect(() => {
		if (typeof bvid !== 'string') {
			router.replace('/+not-found')
		}
	}, [bvid, router])

	if (typeof bvid !== 'string') {
		return null
	}

	if (isMultipageDataPending || isVideoDataPending || !isListReady) {
		return <PlaylistPageSkeleton animate={isListReady} />
	}

	if (isMultipageDataError || isVideoDataError) {
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
						selectMode
							? `已选择\u2009${selected.size}\u2009首`
							: videoData.title
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							testID='remote-playlist-select-all'
							icon='select-all'
							onPress={() => setSelected(new Set(tracksData.map((t) => t.id)))}
						/>
						<Appbar.Action
							testID='remote-playlist-invert-selection'
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
							testID='remote-playlist-batch-add'
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
			</Appbar.Header>

			<PlaylistDetailLayout
				header={
					<PlaylistHeader
						cover={coverRef ?? undefined}
						title={videoData.title}
						subtitles={`${videoData.owner.name}\u2009•\u2009${tracksData.length}\u2009首歌曲`}
						description={videoData.desc}
						onClickMainButton={handleSync}
						mainButtonIcon={'sync'}
						resumeButtonText={resumeButtonText}
						onClickResumeButton={handleResume}
						secondaryButtonText='打开原视频'
						secondaryButtonIcon='open-in-new'
						onClickSecondaryButton={() =>
							void WebBrowser.openBrowserAsync(
								`https://www.bilibili.com/video/${bvid}`,
							)
						}
						linkedPlaylistId={linkedPlaylistId}
						id={bv2av(bvid)}
						primaryButtonColor={primaryButtonColor}
						primaryButtonTextColor={primaryButtonTextColor}
						secondaryButtonContainerColor={secondaryButtonContainerColor}
						secondaryButtonIconColor={secondaryButtonIconColor}
					/>
				}
			>
				{(listHeader) => (
					<TrackList
						listRef={listRef}
						renderCustomItem={renderCustomItem}
						tracks={tracksData}
						playTrack={playTrack}
						trackMenuItems={trackMenuItems}
						selection={selection}
						showItemCover={false}
						ListHeaderComponent={listHeader}
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
				)}
			</PlaylistDetailLayout>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
})
