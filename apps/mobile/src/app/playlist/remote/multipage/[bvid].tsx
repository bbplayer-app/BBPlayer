import type { FlashListRef } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

import NowPlayingBar from '@/components/NowPlayingBar'
import { FlashingTrackListItem } from '@/features/playlist/remote/components/FlashingTrackListItem'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import type { ExtraData } from '@/features/playlist/remote/components/RemoteTrackList'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import useCheckLinkedToPlaylist from '@/features/playlist/remote/hooks/useCheckLinkedToLocalPlaylist'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { usePlaylistSync } from '@/hooks/mutations/db/playlist'
import {
	useGetMultiPageList,
	useGetVideoDetails,
} from '@/hooks/queries/bilibili/video'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { bv2av } from '@/lib/api/bilibili/utils'
import type {
	BilibiliMultipageVideo,
	BilibiliVideoDetails,
} from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import * as Haptics from '@/utils/haptics'
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
	const router = useRouter()
	const { bvid, cid } = useLocalSearchParams<{ bvid: string; cid?: string }>()
	const [refreshing, setRefreshing] = useState(false)
	const { colors } = useTheme()
	const linkedPlaylistId = useCheckLinkedToPlaylist(bv2av(bvid), 'multi_page')

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

	const { mutate: syncMultipage } = usePlaylistSync()

	const { playTrack } = useRemotePlaylist()
	const listRef = useRef<FlashListRef<BilibiliTrack>>(null)
	const { handleDoubleTap } = useDoubleTapScrollToTop(listRef)

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
		if (tracksData.length > 0 && cid) {
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
	}, [cid, tracksData])

	const renderCustomItem = useCallback(
		({
			item,
			index,
			extraData,
		}: ListRenderItemInfoWithExtraData<BilibiliTrack, ExtraData>) => {
			if (!extraData) throw new Error('Extradata 不存在')
			const {
				playTrack: play,
				handleMenuPress,
				selection,
				showItemCover,
			} = extraData

			const shouldFlash = String(item.id) === cid

			return (
				<FlashingTrackListItem
					shouldFlash={shouldFlash}
					index={index}
					onTrackPress={() => play(item)}
					onMenuPress={(anchor) => handleMenuPress(item, anchor)}
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
		[cid],
	)

	useEffect(() => {
		if (typeof bvid !== 'string') {
			router.replace('/+not-found')
		}
	}, [bvid, router])

	if (typeof bvid !== 'string') {
		return null
	}

	if (isMultipageDataPending || isVideoDataPending) {
		return <PlaylistPageSkeleton />
	}

	if (isMultipageDataError || isVideoDataError) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={
						selectMode
							? `已选择\u2009${selected.size}\u2009首`
							: videoData.title
					}
					onPress={handleDoubleTap}
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

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					renderCustomItem={renderCustomItem}
					tracks={tracksData}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					showItemCover={false}
					ListHeaderComponent={
						<PlaylistHeader
							coverUri={videoData.pic}
							title={videoData.title}
							subtitles={`${videoData.owner.name}\u2009•\u2009${tracksData.length}\u2009首歌曲`}
							description={videoData.desc}
							onClickMainButton={handleSync}
							mainButtonIcon={'sync'}
							linkedPlaylistId={linkedPlaylistId}
							id={bv2av(bvid)}
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
