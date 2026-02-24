import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { useImage } from 'expo-image'
import { useNetworkState } from 'expo-network'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Appbar, Menu, Portal, Searchbar, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistHeader } from '@/features/playlist/local/components/LocalPlaylistHeader'
import { TrackListItem } from '@/features/playlist/local/components/LocalPlaylistItem'
import { LocalTrackList } from '@/features/playlist/local/components/LocalTrackList'
import { PlaylistError } from '@/features/playlist/local/components/PlaylistError'
import { useLocalPlaylistMenu } from '@/features/playlist/local/hooks/useLocalPlaylistMenu'
import { useLocalPlaylistPlayer } from '@/features/playlist/local/hooks/useLocalPlaylistPlayer'
import { useTrackSelection } from '@/features/playlist/local/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import {
	useBatchDeleteTracksFromLocalPlaylist,
	useDeletePlaylist,
	usePlaylistSync,
	useReorderLocalPlaylistTrack,
} from '@/hooks/mutations/db/playlist'
import {
	usePlaylistContentsInfinite,
	usePlaylistMetadata,
	useSearchTracksInPlaylist,
} from '@/hooks/queries/db/playlist'
import { useBatchDownloadStatus } from '@/hooks/queries/orpheus'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

const SEARCHBAR_HEIGHT = 72
const SCOPE = 'UI.Playlist.Local'

const SELECT_MODE_ITEM_HEIGHT = 69

/** px from top/bottom edge of list container that triggers auto-scroll */
const EDGE_ZONE = 80
/** px scrolled per auto-scroll tick (~16 ms) */
const SCROLL_SPEED = 8

export default function LocalPlaylistPage() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const theme = useTheme()
	const { colors } = theme
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const dimensions = useWindowDimensions()
	const [searchQuery, setSearchQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const searchbarHeight = useSharedValue(0)
	const deferredQuery = useDeferredValue(searchQuery)
	const { selected, selectMode, toggle, enterSelectMode, exitSelectMode } =
		useTrackSelection()

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop<Track>()

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
	const [functionalMenuVisible, setFunctionalMenuVisible] = useState(false)

	const {
		data: playlistData,
		isPending: isPlaylistDataPending,
		isError: isPlaylistDataError,
		fetchNextPage: fetchNextPagePlaylistData,
		hasNextPage: hasNextPagePlaylistData,
		isFetchingNextPage: isFetchingNextPagePlaylistData,
	} = usePlaylistContentsInfinite(Number(id), 30, 15)
	const allLoadedTracks = useMemo(
		() =>
			(
				playlistData?.pages as Array<{ tracks: Track[]; sortKeys: string[] }>
			)?.flatMap((page) => page.tracks) ?? [],
		[playlistData],
	)
	/** DB `sort_key` values parallel to allLoadedTracks (needed for reorder mutation) */
	const allLoadedSortKeys = useMemo(
		() =>
			(
				playlistData?.pages as Array<{ tracks: Track[]; sortKeys: string[] }>
			)?.flatMap((page) => page.sortKeys) ?? [],
		[playlistData],
	)

	const networkState = useNetworkState()
	const isOffline = networkState.isConnected === false

	const loadedTrackKeys = useMemo(
		() => allLoadedTracks.map((t) => t.uniqueKey),
		[allLoadedTracks],
	)
	const { data: downloadStatus } = useBatchDownloadStatus(loadedTrackKeys)

	const playableOfflineKeys = useMemo(() => {
		if (!allLoadedTracks.length) return new Set<string>()

		const keys = new Set<string>()
		const urisToCheck: { uniqueKey: string; uri: string }[] = []

		for (const track of allLoadedTracks) {
			if (track.source === 'local') {
				keys.add(track.uniqueKey)
				continue
			}
			const uri = getInternalPlayUri(track)
			if (uri) {
				urisToCheck.push({ uniqueKey: track.uniqueKey, uri })
			}
		}

		const validUris = new Set(
			Orpheus.getLruCachedUris(urisToCheck.map((u) => u.uri)),
		)
		for (const item of urisToCheck) {
			if (
				validUris.has(item.uri) ||
				downloadStatus?.[item.uniqueKey] === DownloadState.COMPLETED
			) {
				keys.add(item.uniqueKey)
			}
		}
		return keys
	}, [allLoadedTracks, downloadStatus])

	const batchAddTracksModalPayloads = (() => {
		const payloads = []
		for (const trackId of selected) {
			const track = (playlistData?.pages as Array<{ tracks: Track[] }>)
				?.flatMap((page) => page.tracks)
				.find((t) => t.id === trackId)
			if (!track) return []
			payloads.push({
				track: {
					...track,
					artistId: track.artist?.id,
				},
				artist: track.artist!,
			})
		}
		return payloads
	})()

	const {
		data: searchData,
		isError: isSearchError,
		error: searchError,
	} = useSearchTracksInPlaylist(Number(id), deferredQuery, startSearch)

	const finalPlaylistData = (() => {
		if (!startSearch || !deferredQuery.trim()) {
			return allLoadedTracks
		}

		if (isSearchError) {
			toastAndLogError('搜索失败', searchError, SCOPE)
			return []
		}

		return searchData ?? []
	})()

	const {
		data: playlistMetadata,
		isPending: isPlaylistMetadataPending,
		isError: isPlaylistMetadataError,
	} = usePlaylistMetadata(Number(id))

	const coverRef = useImage(playlistMetadata?.coverUrl ?? '', {
		onError: () => void 0,
	})
	const { backgroundColor, nowPlayingBarColor } = usePlaylistBackgroundColor(
		coverRef,
		theme.dark,
		colors.background,
	)

	const { mutate: syncPlaylist } = usePlaylistSync()
	const { mutate: deletePlaylist } = useDeletePlaylist()
	const { mutate: deleteTrackFromLocalPlaylist } =
		useBatchDeleteTracksFromLocalPlaylist()
	const { mutate: reorderTrack } = useReorderLocalPlaylistTrack()

	const onClickDeletePlaylist = useCallback(() => {
		deletePlaylist(
			{ playlistId: Number(id) },
			{ onSuccess: () => router.back() },
		)
	}, [deletePlaylist, id, router])

	const handleSync = useCallback(() => {
		if (!playlistMetadata || !playlistMetadata.remoteSyncId) {
			toast.error(
				'无法同步，因为未找到播放列表元数据或\u2009remoteSyncId\u2009为空',
			)
			return
		}

		if (playlistMetadata.type === 'favorite') {
			openModal(
				'FavoriteSyncProgress',
				{
					favoriteId: Number(playlistMetadata.remoteSyncId),
					shouldRedirectToLocalPlaylist: false,
				},
				{ dismissible: false },
			)
			return
		}

		const toastId = 'sync-playlist'
		toast.show('同步中...', { id: toastId, duration: Infinity })
		syncPlaylist({
			remoteSyncId: playlistMetadata.remoteSyncId,
			type: playlistMetadata.type,
			toastId,
		})
	}, [playlistMetadata, syncPlaylist, openModal])

	const { playAll, handleTrackPress } = useLocalPlaylistPlayer(
		Number(id),
		isOffline,
		playableOfflineKeys,
	)

	const deleteTrack = useCallback(
		(trackId: number) => {
			deleteTrackFromLocalPlaylist({
				trackIds: [trackId],
				playlistId: Number(id),
			})
		},
		[deleteTrackFromLocalPlaylist, id],
	)

	const trackMenuItems = useLocalPlaylistMenu({
		deleteTrack,
		openAddToPlaylistModal: (track) =>
			openModal('UpdateTrackLocalPlaylists', { track }),
		openEditTrackModal: (track) => openModal('EditTrackMetadata', { track }),
		playlist: playlistMetadata!,
	})

	const deleteSelectedTracks = useCallback(() => {
		if (selected.size === 0) return
		deleteTrackFromLocalPlaylist({
			trackIds: Array.from(selected),
			playlistId: Number(id),
		})
		exitSelectMode()
	}, [selected, id, deleteTrackFromLocalPlaylist, exitSelectMode])

	useEffect(() => {
		if (typeof id !== 'string') {
			router.replace('/+not-found')
		}
	}, [id, router])

	usePreventRemove(startSearch || selectMode, () => {
		if (startSearch) setStartSearch(false)
		if (selectMode) exitSelectMode()
	})

	useEffect(() => {
		searchbarHeight.set(
			withTiming(startSearch ? SEARCHBAR_HEIGHT : 0, { duration: 180 }),
		)
	}, [searchbarHeight, startSearch])

	const searchbarAnimatedStyle = useAnimatedStyle(() => ({
		height: searchbarHeight.value,
	}))

	const [dragging, setDragging] = useState<{
		trackIndex: number
		trackId: number
	} | null>(null)

	/** Index AFTER which to show the insertion line (-1 = before item 0) */
	const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null)

	/** Ghost Y relative to the list container */
	const ghostY = useSharedValue(0)

	const dragOriginRef = useRef(0)

	/** Absolute screen Y of the top of the list container (from measureInWindow) */
	const containerTopRef = useRef(0)
	const containerHeightRef = useRef(0)
	const listContainerRef = useRef<View>(null)

	/** Current FlashList scroll offset */
	const scrollOffsetRef = useRef(0)

	/** Auto-scroll interval handle */
	const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const stopAutoScroll = useCallback(() => {
		if (autoScrollRef.current !== null) {
			clearInterval(autoScrollRef.current)
			autoScrollRef.current = null
		}
	}, [])

	const startAutoScroll = useCallback(
		(direction: 'up' | 'down') => {
			stopAutoScroll()
			autoScrollRef.current = setInterval(() => {
				const delta = direction === 'down' ? SCROLL_SPEED : -SCROLL_SPEED
				const next = Math.max(0, scrollOffsetRef.current + delta)
				listRef.current?.scrollToOffset({ offset: next, animated: false })
				scrollOffsetRef.current = next
			}, 16)
		},
		[stopAutoScroll, listRef],
	)

	const updateDragPosition = useCallback(
		(absoluteY: number) => {
			// Ghost: center it on the finger relative to the container
			ghostY.set(
				absoluteY - containerTopRef.current - SELECT_MODE_ITEM_HEIGHT / 2,
			)

			// Insert index: use calibration so that item-0 touches the origin correctly
			const hoverRel =
				absoluteY + scrollOffsetRef.current - dragOriginRef.current
			const k = Math.floor(hoverRel / SELECT_MODE_ITEM_HEIGHT)
			// Upper/lower half of item k determines whether to insert before or after
			const inItemFrac =
				(hoverRel - k * SELECT_MODE_ITEM_HEIGHT) / SELECT_MODE_ITEM_HEIGHT
			const insertIdx = inItemFrac >= 0.5 ? k : k - 1
			setInsertAfterIndex(
				Math.max(-1, Math.min(insertIdx, finalPlaylistData.length - 1)),
			)

			// Edge auto-scroll
			const containerRelY = absoluteY - containerTopRef.current
			if (containerRelY < EDGE_ZONE) {
				startAutoScroll('up')
			} else if (containerRelY > containerHeightRef.current - EDGE_ZONE) {
				startAutoScroll('down')
			} else {
				stopAutoScroll()
			}
		},
		[finalPlaylistData.length, ghostY, startAutoScroll, stopAutoScroll],
	)

	const draggingRef = useRef(dragging)
	const insertAfterIndexRef = useRef(insertAfterIndex)
	useEffect(() => {
		draggingRef.current = dragging
	}, [dragging])
	useEffect(() => {
		insertAfterIndexRef.current = insertAfterIndex
	}, [insertAfterIndex])

	const handleDragStart = useCallback(
		(trackIndex: number, trackId: number, absoluteY: number) => {
			void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
			// Calibrate: store the virtual Y-origin so item i is at origin + i * H
			dragOriginRef.current =
				absoluteY +
				scrollOffsetRef.current -
				trackIndex * SELECT_MODE_ITEM_HEIGHT
			setDragging({ trackIndex, trackId })
			// Ghost starts centered on the finger
			ghostY.set(
				absoluteY - containerTopRef.current - SELECT_MODE_ITEM_HEIGHT / 2,
			)
			setInsertAfterIndex(trackIndex - 1)
		},
		[ghostY],
	)

	const handleDragUpdate = useCallback(
		(absoluteY: number) => {
			updateDragPosition(absoluteY)
		},
		[updateDragPosition],
	)

	const handleDragEnd = useCallback(() => {
		stopAutoScroll()
		const currentDragging = draggingRef.current
		const currentInsertAfterIndex = insertAfterIndexRef.current

		if (!currentDragging || currentInsertAfterIndex === null) {
			setDragging(null)
			setInsertAfterIndex(null)
			return
		}

		const { trackIndex, trackId } = currentDragging

		// Adjust target visual index based on drag direction
		const targetVisualIndex =
			currentInsertAfterIndex >= trackIndex
				? currentInsertAfterIndex
				: currentInsertAfterIndex + 1

		if (targetVisualIndex !== trackIndex) {
			const clamped = Math.max(
				0,
				Math.min(targetVisualIndex, finalPlaylistData.length - 1),
			)
			// 显示为 DESC 排序：index 0 = 最高 sort_key，index N-1 = 最低 sort_key
			// 向下拖（clamped > trackIndex）：新位置夹在 [clamped] 和 [clamped+1] 之间
			// 向上拖（clamped < trackIndex）：新位置夹在 [clamped-1] 和 [clamped] 之间
			let prevSortKey: string | null
			let nextSortKey: string | null
			if (targetVisualIndex > trackIndex) {
				// 向列表底部方向移动（sort_key 降低）
				prevSortKey = allLoadedSortKeys[clamped + 1] ?? null
				nextSortKey = allLoadedSortKeys[clamped] ?? null
			} else {
				// 向列表顶部方向移动（sort_key 升高）
				prevSortKey = allLoadedSortKeys[clamped] ?? null
				nextSortKey = allLoadedSortKeys[clamped - 1] ?? null
			}
			reorderTrack({
				playlistId: Number(id),
				trackId,
				prevSortKey,
				nextSortKey,
			})
		}

		setDragging(null)
		setInsertAfterIndex(null)
	}, [
		stopAutoScroll,
		finalPlaylistData.length,
		allLoadedSortKeys,
		reorderTrack,
		id,
	])

	const ghostAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: ghostY.value }],
	}))

	const draggedTrack =
		dragging !== null ? finalPlaylistData[dragging.trackIndex] : null

	if (typeof id !== 'string') return null
	if (isPlaylistDataPending || isPlaylistMetadataPending)
		return <PlaylistPageSkeleton />
	if (isPlaylistDataError || isPlaylistMetadataError)
		return <PlaylistError text='加载播放列表内容失败' />
	if (!playlistMetadata) return <PlaylistError text='未找到播放列表元数据' />

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title={
						selectMode
							? `已选择\u2009${selected.size}\u2009首`
							: playlistMetadata.title
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<>
						{playlistMetadata.type === 'local' && (
							<Appbar.Action
								icon='trash-can'
								onPress={() =>
									alert(
										'移除歌曲',
										'确定从播放列表移除这些歌曲？',
										[
											{ text: '取消' },
											{ text: '确定', onPress: deleteSelectedTracks },
										],
										{ cancelable: true },
									)
								}
							/>
						)}
						<Appbar.Action
							icon='playlist-plus'
							onPress={() =>
								openModal('BatchAddTracksToLocalPlaylist', {
									payloads: batchAddTracksModalPayloads,
								})
							}
						/>
					</>
				) : (
					<>
						<Appbar.Action
							icon={startSearch ? 'close' : 'magnify'}
							onPress={() => setStartSearch((prev) => !prev)}
						/>
						<Appbar.Action
							icon='dots-vertical'
							onPress={() => setFunctionalMenuVisible(true)}
						/>
					</>
				)}
			</Appbar.Header>

			{/* 搜索框 */}
			<Animated.View
				style={[styles.searchbarContainer, searchbarAnimatedStyle]}
			>
				<Searchbar
					mode='view'
					placeholder='搜索歌曲'
					onChangeText={setSearchQuery}
					value={searchQuery}
				/>
			</Animated.View>

			<View
				ref={listContainerRef}
				style={{ flex: 1 }}
				onLayout={() => {
					listContainerRef.current?.measureInWindow((_x, y, _w, h) => {
						containerTopRef.current = y
						containerHeightRef.current = h
					})
				}}
			>
				<LocalTrackList
					listRef={listRef}
					isStale={searchQuery !== deferredQuery}
					tracks={finalPlaylistData ?? []}
					playlist={playlistMetadata}
					handleTrackPress={handleTrackPress}
					trackMenuItems={trackMenuItems}
					selection={selection}
					isOffline={isOffline}
					playableOfflineKeys={playableOfflineKeys}
					onEndReached={
						hasNextPagePlaylistData &&
						!startSearch &&
						!isFetchingNextPagePlaylistData
							? () => fetchNextPagePlaylistData()
							: undefined
					}
					onDragStart={
						selectMode && playlistMetadata.type === 'local'
							? handleDragStart
							: undefined
					}
					onDragUpdate={
						selectMode && playlistMetadata.type === 'local'
							? handleDragUpdate
							: undefined
					}
					onDragEnd={
						selectMode && playlistMetadata.type === 'local'
							? handleDragEnd
							: undefined
					}
					insertAfterIndex={dragging !== null ? insertAfterIndex : null}
					onScroll={(e) => {
						scrollOffsetRef.current = e.nativeEvent.contentOffset.y
					}}
					ListHeaderComponent={
						<PlaylistHeader
							coverRef={coverRef}
							playlist={playlistMetadata}
							totalDuration={playlistMetadata.totalDuration}
							onClickPlayAll={playAll}
							onClickSync={handleSync}
							onClickCopyToLocalPlaylist={() =>
								openModal('DuplicateLocalPlaylist', {
									sourcePlaylistId: Number(id),
									rawName: playlistMetadata.title,
								})
							}
							onPressAuthor={(author) =>
								author.remoteId &&
								router.push({
									pathname: '/playlist/remote/uploader/[mid]',
									params: { mid: author.remoteId },
								})
							}
						/>
					}
				/>

				{dragging !== null && draggedTrack && (
					<Animated.View
						pointerEvents='none'
						style={[styles.ghostContainer, ghostAnimatedStyle]}
					>
						<View style={styles.ghostInner}>
							<TrackListItem
								index={dragging.trackIndex}
								data={draggedTrack}
								playlist={playlistMetadata}
								selectMode={true}
								isSelected={false}
								toggleSelected={() => void 0}
								enterSelectMode={() => void 0}
								onTrackPress={() => void 0}
								onMenuPress={() => void 0}
							/>
						</View>
					</Animated.View>
				)}
			</View>

			<Portal>
				<FunctionalMenu
					visible={functionalMenuVisible}
					onDismiss={() => setFunctionalMenuVisible(false)}
					anchor={{
						x: dimensions.width - 10,
						y: 60 + insets.top,
					}}
				>
					{playlistMetadata.type === 'local' && (
						<Menu.Item
							onPress={() => {
								setFunctionalMenuVisible(false)
								enterSelectMode()
							}}
							title='排序'
							leadingIcon='sort'
						/>
					)}
					<Menu.Item
						onPress={() => {
							setFunctionalMenuVisible(false)
							openModal('EditPlaylistMetadata', { playlist: playlistMetadata })
						}}
						title='编辑播放列表信息'
						leadingIcon='pencil'
					/>
					{playlistMetadata.type === 'local' &&
						playlistMetadata.remoteSyncId === null && (
							<Menu.Item
								onPress={() => {
									setFunctionalMenuVisible(false)
									openModal(
										'SyncLocalToBilibili',
										{ playlistId: Number(id) },
										{ dismissible: false },
									)
								}}
								title='同步到 B 站'
								leadingIcon='sync'
							/>
						)}
					<Menu.Item
						onPress={() => {
							setFunctionalMenuVisible(false)
							alert(
								'删除播放列表',
								'确定要删除此播放列表吗？',
								[
									{ text: '取消' },
									{ text: '确定', onPress: onClickDeletePlaylist },
								],
								{ cancelable: true },
							)
						}}
						title='删除播放列表'
						leadingIcon='delete'
						titleStyle={{ color: colors.error }}
					/>
				</FunctionalMenu>
			</Portal>

			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar backgroundColor={nowPlayingBarColor} />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	searchbarContainer: { overflow: 'hidden' },
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
	ghostContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
	},
	ghostInner: {
		opacity: 0.85,
		elevation: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
	},
})
