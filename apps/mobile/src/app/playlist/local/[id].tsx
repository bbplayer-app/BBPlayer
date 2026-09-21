import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
import { MenuView } from '@expo/ui/community/menu'
import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import { and, eq } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { useImage } from 'expo-image'
import { useObserve } from 'expo-observe'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { StyleSheet, View } from 'react-native'
import { Appbar, MD3Theme, Text, useTheme } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import { PlaylistHeader } from '@/features/playlist/local/components/LocalPlaylistHeader'
import { TrackListItem } from '@/features/playlist/local/components/LocalPlaylistItem'
import { LocalTrackList } from '@/features/playlist/local/components/LocalTrackList'
import { PlaylistError } from '@/features/playlist/local/components/PlaylistError'
import { PlaylistPlayerPreferenceDialog } from '@/features/playlist/local/components/PlaylistPlayerPreferenceDialog'
import { SharedPlaylistMembersSheet } from '@/features/playlist/local/components/SharedPlaylistMembersSheet'
import { SyncFailuresSheet } from '@/features/playlist/local/components/SyncFailuresSheet'
import { useLocalPlaylistMenu } from '@/features/playlist/local/hooks/useLocalPlaylistMenu'
import { useLocalPlaylistPlayer } from '@/features/playlist/local/hooks/useLocalPlaylistPlayer'
import { useTrackSelection } from '@/features/playlist/local/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import {
	useBatchDeleteTracksFromLocalPlaylist,
	useDeletePlaylist,
	useEditPlaylistMetadata,
	usePullSharedPlaylist,
	usePlaylistSync,
	useReorderLocalPlaylistTrack,
} from '@/hooks/mutations/db/playlist'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	useAllPlaylistsContainingTrack,
	usePlaylistContentsInfinite,
	usePlaylistMetadata,
	useSearchTracksInPlaylist,
} from '@/hooks/queries/db/playlist'
import { useBatchDownloadStatus } from '@/hooks/queries/orpheus'
import { useSharedPlaylistMembers } from '@/hooks/queries/sharedPlaylistMembers'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { useIsActuallyOffline } from '@/hooks/utils/useIsActuallyOffline'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { CustomError } from '@/lib/errors'
import { playlistService } from '@/lib/services/playlistService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

const SORT_ICON = Icon.select({
	ios: 'arrow.up.and.down.text.horizontal',
	android: import('@expo/material-symbols/sort.xml'),
})

const EDIT_ICON = Icon.select({
	ios: 'pencil',
	android: import('@expo/material-symbols/edit.xml'),
})

const SYNC_ICON = Icon.select({
	ios: 'arrow.triangle.2.circlepath',
	android: import('@expo/material-symbols/sync.xml'),
})

const SHARE_ICON = Icon.select({
	ios: 'square.and.arrow.up',
	android: import('@expo/material-symbols/share.xml'),
})

const LINK_ICON = Icon.select({
	ios: 'link',
	android: import('@expo/material-symbols/link.xml'),
})

const DELETE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const PIN_ICON = Icon.select({
	ios: 'pin.fill',
	android: import('@expo/material-symbols/keep.xml'),
})

const UNPIN_ICON = Icon.select({
	ios: 'pin',
	android: import('@expo/material-symbols/keep_off.xml'),
})

const PREFERRED_ICON = Icon.select({
	ios: 'headphones',
	android: import('@expo/material-symbols/headphones.xml'),
})

const SEARCHBAR_HEIGHT = 72
const SCOPE = 'UI.Playlist.Local'

const SELECT_MODE_ITEM_HEIGHT = 69

/** px from top/bottom edge of list container that triggers auto-scroll */
const EDGE_ZONE = 80
/** px scrolled per auto-scroll tick (~16 ms) */
const SCROLL_SPEED = 8

type PlaylistContentsData = NonNullable<
	ReturnType<typeof usePlaylistContentsInfinite>['data']
>
type PlaylistMetadata = NonNullable<
	ReturnType<typeof usePlaylistMetadata>['data']
>

const deletePlaylistDialogPrompt = (
	playlistMetadata: ReturnType<typeof usePlaylistMetadata>['data'],
	colors: MD3Theme['colors'],
) => {
	if (!playlistMetadata || playlistMetadata.shareId === null)
		return '确定要删除此播放列表吗？'
	switch (playlistMetadata?.shareRole) {
		case 'owner':
			return (
				<>
					<Text>确定要删除此播放列表吗？</Text>
					<Text style={{ color: colors.error }}>
						同时所有订阅过该播放列表的人也会失去访问权限。
					</Text>
				</>
			)
		case 'editor':
			return (
				<>
					<Text>确定要删除此播放列表吗？</Text>
					<Text style={{ color: colors.error }}>
						同时你也会失去访问权限，下次需要由共享歌单的人再次邀请。
					</Text>
				</>
			)
		case 'subscriber':
			return (
				<>
					<Text>确定要删除此播放列表吗？</Text>
					<Text style={{ color: colors.error }}>
						同时你也会失去访问权限，下次需要由共享歌单的人再次邀请。
					</Text>
				</>
			)
	}
	return <Text>确定要删除此播放列表吗？</Text>
}

export default function LocalPlaylistPage() {
	const isListReady = useScreenTransitionReady()
	const { id } = useLocalSearchParams<{ id: string }>()
	const { markInteractive } = useObserve()

	useEffect(() => {
		markInteractive()
	}, [markInteractive])
	const {
		data: playlistData,
		isPending: isPlaylistDataPending,
		isError: isPlaylistDataError,
		fetchNextPage: fetchNextPagePlaylistData,
		hasNextPage: hasNextPagePlaylistData,
		isFetchingNextPage: isFetchingNextPagePlaylistData,
	} = usePlaylistContentsInfinite(Number(id), 30, 15)
	const {
		data: playlistMetadata,
		isPending: isPlaylistMetadataPending,
		isError: isPlaylistMetadataError,
	} = usePlaylistMetadata(Number(id))

	if (typeof id !== 'string') return null
	if (isPlaylistDataPending || isPlaylistMetadataPending || !isListReady)
		return <PlaylistPageSkeleton animate={isListReady} />
	if (isPlaylistDataError || isPlaylistMetadataError)
		return <PlaylistError text='加载播放列表内容失败' />
	if (!playlistData || !playlistMetadata)
		return <PlaylistError text='未找到播放列表元数据' />

	return (
		<LocalPlaylistContent
			id={id}
			playlistData={playlistData}
			fetchNextPagePlaylistData={fetchNextPagePlaylistData}
			hasNextPagePlaylistData={hasNextPagePlaylistData}
			isFetchingNextPagePlaylistData={isFetchingNextPagePlaylistData}
			playlistMetadata={playlistMetadata}
		/>
	)
}

function LocalPlaylistContent({
	id,
	playlistData,
	fetchNextPagePlaylistData,
	hasNextPagePlaylistData,
	isFetchingNextPagePlaylistData,
	playlistMetadata,
}: {
	id: string
	playlistData: PlaylistContentsData
	fetchNextPagePlaylistData: ReturnType<
		typeof usePlaylistContentsInfinite
	>['fetchNextPage']
	hasNextPagePlaylistData: boolean
	isFetchingNextPagePlaylistData: boolean
	playlistMetadata: PlaylistMetadata
}) {
	const theme = useTheme()
	const { colors } = theme
	const [playerPreferenceVisible, setPlayerPreferenceVisible] = useState(false)
	const [isResolvingSelection, setIsResolvingSelection] = useState(false)
	const router = useRouter()
	const bbplayerToken = useAppStore((state) => state.bbplayerToken)
	const [searchQuery, setSearchQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const searchbarHeight = useSharedValue(0)
	const deferredQuery = useDeferredValue(searchQuery)
	const {
		selected,
		selectMode,
		toggle,
		enterSelectMode,
		exitSelectMode,
		setSelected,
	} = useTrackSelection()

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()
	const currentTrack = useCurrentTrack()
	const membersSheetRef = useRef<TrueSheet>(null)
	const syncFailuresSheetRef = useRef<TrueSheet>(null)
	const [membersSheetMounted, setMembersSheetMounted] = useState(false)
	const [syncFailuresSheetMounted, setSyncFailuresSheetMounted] =
		useState(false)
	const setMembersSheetRef = useCallback((sheet: TrueSheet | null) => {
		membersSheetRef.current = sheet
		if (sheet) void sheet.present()
	}, [])
	const setSyncFailuresSheetRef = useCallback((sheet: TrueSheet | null) => {
		syncFailuresSheetRef.current = sheet
		if (sheet) void sheet.present()
	}, [])

	const selection = {
		active: selectMode,
		selected,
		toggle,
		enter: enterSelectMode,
	}
	const openModal = useModalStore((state) => state.open)

	const { data: playlistsContainingCurrentTrack } =
		useAllPlaylistsContainingTrack(currentTrack?.uniqueKey)
	const allLoadedTracks =
		(
			playlistData?.pages as Array<{
				tracks: Track[]
				sortKeys: string[]
				nextPageFirstSortKey?: string
			}>
		)?.flatMap((page) => page.tracks) ?? []
	/** DB `sort_key` values parallel to allLoadedTracks (needed for reorder mutation) */
	const allLoadedSortKeys =
		(
			playlistData?.pages as Array<{
				tracks: Track[]
				sortKeys: string[]
				nextPageFirstSortKey?: string
			}>
		)?.flatMap((page) => page.sortKeys) ?? []

	const isOffline = useIsActuallyOffline()

	const loadedTrackKeys = allLoadedTracks.map((t) => t.uniqueKey)
	const { data: downloadStatus } = useBatchDownloadStatus(loadedTrackKeys)

	const playableOfflineKeys = (() => {
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
	const currentTrackKey = currentTrack?.uniqueKey
	const currentTrackIndex = useMemo(
		() =>
			currentTrackKey
				? finalPlaylistData.findIndex(
						(track) => track.uniqueKey === currentTrackKey,
					)
				: -1,
		[finalPlaylistData, currentTrackKey],
	)
	const [visibleTrackKeys, setVisibleTrackKeys] = useState<string[]>([])
	const [isLocatingCurrentTrack, setIsLocatingCurrentTrack] = useState(false)
	const lastCurrentTrackLookupPageCountRef = useRef<number | null>(null)

	const isCurrentTrackInPlaylist = playlistsContainingCurrentTrack?.some(
		(playlist) => playlist.id === Number(id),
	)
	const isCurrentTrackVisible =
		!currentTrackKey || visibleTrackKeys.includes(currentTrackKey)

	const handleViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: { item: Track }[] }) => {
			setVisibleTrackKeys(viewableItems.map(({ item }) => item.uniqueKey))
		},
		[],
	)

	const locateCurrentTrack = useCallback(() => {
		lastCurrentTrackLookupPageCountRef.current = null
		setIsLocatingCurrentTrack(true)
	}, [])

	useEffect(() => {
		if (!isLocatingCurrentTrack || !currentTrackKey) return

		if (currentTrackIndex !== -1) {
			void listRef.current?.scrollToIndex({
				index: currentTrackIndex,
				animated: true,
				viewPosition: 0.5,
			})
			setVisibleTrackKeys((keys) =>
				keys.includes(currentTrackKey) ? keys : [...keys, currentTrackKey],
			)
			setIsLocatingCurrentTrack(false)
			return
		}

		if (hasNextPagePlaylistData && !isFetchingNextPagePlaylistData) {
			const loadedPageCount = playlistData?.pages.length ?? 0
			if (lastCurrentTrackLookupPageCountRef.current === loadedPageCount) {
				setIsLocatingCurrentTrack(false)
				return
			}
			lastCurrentTrackLookupPageCountRef.current = loadedPageCount
			void fetchNextPagePlaylistData().catch(() => {
				setIsLocatingCurrentTrack(false)
			})
			return
		}

		if (!hasNextPagePlaylistData) {
			setIsLocatingCurrentTrack(false)
		}
	}, [
		currentTrackIndex,
		currentTrackKey,
		fetchNextPagePlaylistData,
		hasNextPagePlaylistData,
		isFetchingNextPagePlaylistData,
		isLocatingCurrentTrack,
		listRef,
		playlistData?.pages.length,
	])

	const shareMembers = useSharedPlaylistMembers(playlistMetadata?.shareId)
	const isSharedSubscriber = playlistMetadata?.shareRole === 'subscriber'
	const isSharedLoggedOut = !!playlistMetadata?.shareId && !bbplayerToken
	const coverRef = useImage(
		resolveBilibiliImageUrl(playlistMetadata?.coverUrl) ?? '',
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

	const { mutate: syncPlaylist } = usePlaylistSync()
	const { mutate: deletePlaylist } = useDeletePlaylist()
	const { mutate: editPlaylistMetadata } = useEditPlaylistMetadata()
	const { mutate: deleteTrackFromLocalPlaylist } =
		useBatchDeleteTracksFromLocalPlaylist()
	const { mutate: reorderTrack } = useReorderLocalPlaylistTrack()
	const { mutate: pullSharedPlaylist, isPending: isPullingShared } =
		usePullSharedPlaylist()

	const presentMembersSheet = useCallback(() => {
		if (membersSheetRef.current) {
			void membersSheetRef.current.present()
			return
		}
		setMembersSheetMounted(true)
	}, [])

	const presentSyncFailuresSheet = useCallback(() => {
		if (syncFailuresSheetRef.current) {
			void syncFailuresSheetRef.current.present()
			return
		}
		setSyncFailuresSheetMounted(true)
	}, [])

	const handlePressShareMember = () => {
		if (isSharedLoggedOut) {
			toast.error('登陆 BBPlayer 账号后才能查看共享成员')
			return
		}
		if (playlistMetadata?.shareId) {
			presentMembersSheet()
		}
	}

	const onClickDeletePlaylist = () => {
		deletePlaylist(
			{ playlistId: Number(id) },
			{ onSuccess: () => router.back() },
		)
	}

	const handleSync = () => {
		if (!playlistMetadata || !playlistMetadata.remoteSyncId) {
			toast.error(
				'无法同步，因为未找到播放列表元数据或\u2009remoteSyncId\u2009为空',
			)
			return
		}

		if (playlistMetadata.type === 'favorite') {
			const { expandMultiPageOnSync } = useAppStore.getState().settings
			if (expandMultiPageOnSync === null) {
				openModal('SyncOptions', {
					favoriteId: playlistMetadata.remoteSyncId,
				})
				return
			}
			openModal(
				'FavoriteSyncProgress',
				{
					favoriteId: playlistMetadata.remoteSyncId,
					expandMultiPage: expandMultiPageOnSync,
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
	}

	const { playAll, handleTrackPress } = useLocalPlaylistPlayer(
		Number(id),
		isOffline,
		playableOfflineKeys,
	)
	const pullingIcon = useMemo(
		() => () => (
			<ActivityIndicator
				size='small'
				color={colors.primary}
			/>
		),
		[colors.primary],
	)

	const deleteTrack = (trackId: number) => {
		deleteTrackFromLocalPlaylist({
			trackIds: [trackId],
			playlistId: Number(id),
		})
	}

	const trackMenuItems = useLocalPlaylistMenu({
		deleteTrack,
		openAddToPlaylistModal: (track) =>
			openModal('UpdateTrackLocalPlaylists', { track }),
		openEditTrackModal: (track) => openModal('EditTrackMetadata', { track }),
		playlist: playlistMetadata,
		isReadOnly: isSharedSubscriber,
	})

	const deleteSelectedTracks = () => {
		if (selected.size === 0) return
		deleteTrackFromLocalPlaylist({
			trackIds: Array.from(selected),
			playlistId: Number(id),
		})
		exitSelectMode()
	}

	const clearInvalidVideos = async () => {
		const tracksResult = await playlistService.getPlaylistTracks(Number(id))
		if (tracksResult.isErr()) {
			toastAndLogError('获取播放列表歌曲失败', tracksResult.error, SCOPE)
			return
		}

		const invalidTrackIds = tracksResult.value
			.filter(
				(track) =>
					track.source === 'bilibili' && !track.bilibiliMetadata.videoIsValid,
			)
			.map((track) => track.id)
		if (invalidTrackIds.length === 0) {
			toast.info('没有需要清除的失效视频')
			return
		}

		deleteTrackFromLocalPlaylist({
			trackIds: invalidTrackIds,
			playlistId: Number(id),
		})
	}

	const getSelectionScopeTracks = async () => {
		const tracksResult =
			startSearch && deferredQuery.trim()
				? await playlistService.searchTrackInPlaylist(Number(id), deferredQuery)
				: await playlistService.getPlaylistTracks(Number(id))
		if (tracksResult.isErr()) {
			toastAndLogError('获取播放列表歌曲失败', tracksResult.error, SCOPE)
			return null
		}
		return tracksResult.value
	}

	const selectAllTracks = async () => {
		setIsResolvingSelection(true)
		try {
			const tracks = await getSelectionScopeTracks()
			if (!tracks) return
			setSelected(new Set(tracks.map((track) => track.id)))
		} finally {
			setIsResolvingSelection(false)
		}
	}

	const invertSelectedTracks = async () => {
		setIsResolvingSelection(true)
		try {
			const tracks = await getSelectionScopeTracks()
			if (!tracks) return
			setSelected(
				new Set(
					tracks
						.filter((track) => !selected.has(track.id))
						.map((track) => track.id),
				),
			)
		} finally {
			setIsResolvingSelection(false)
		}
	}

	const openBatchAddTracksModal = async () => {
		setIsResolvingSelection(true)
		try {
			const tracksResult = await playlistService.getPlaylistTracks(Number(id))
			if (tracksResult.isErr()) {
				toastAndLogError('获取播放列表歌曲失败', tracksResult.error, SCOPE)
				return
			}
			const selectedTracks = tracksResult.value.filter((track) =>
				selected.has(track.id),
			)
			openModal('BatchAddTracksToLocalPlaylist', {
				payloads: selectedTracks.map((track) => ({
					track: { ...track, artistId: track.artist?.id },
					artist: track.artist!,
				})),
			})
		} finally {
			setIsResolvingSelection(false)
		}
	}

	/** 防止重复处理共享歌单被删除的场景 */
	const handledRemoteDeletionRef = useRef(false)

	useEffect(() => {
		handledRemoteDeletionRef.current = false
	}, [id])

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

	useEffect(() => {
		if (typeof id !== 'string') return
		if (!playlistMetadata?.shareId || !playlistMetadata.shareRole) return
		if (isOffline) return
		if (!bbplayerToken) return
		pullSharedPlaylist(
			{ playlistId: Number(id) },
			{
				onError: (error) => {
					if (
						handledRemoteDeletionRef.current ||
						!(error instanceof CustomError) ||
						error.type !== 'SharedPlaylistDeleted'
					) {
						return
					}
					handledRemoteDeletionRef.current = true
					toast.error('共享者已删除该歌单，已为你移除本地副本')
					deletePlaylist(
						{ playlistId: Number(id) },
						{ onSuccess: () => router.back() },
					)
				},
			},
		)
	}, [
		id,
		isOffline,
		playlistMetadata?.shareId,
		playlistMetadata?.shareRole,
		bbplayerToken,
		handledRemoteDeletionRef,
		deletePlaylist,
		router,
		pullSharedPlaylist,
	])

	const { data: syncFailures } = useLiveQuery(
		db
			.select({ id: schema.playlistSyncQueue.id })
			.from(schema.playlistSyncQueue)
			.where(
				and(
					eq(schema.playlistSyncQueue.playlistId, playlistMetadata?.id ?? -1),
					eq(schema.playlistSyncQueue.status, 'failed'),
				),
			)
			.limit(1),
	)
	const hasSyncFailures =
		!!playlistMetadata?.shareId && (syncFailures?.length ?? 0) > 0

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

	const stopAutoScroll = () => {
		if (autoScrollRef.current !== null) {
			clearInterval(autoScrollRef.current)
			autoScrollRef.current = null
		}
	}

	// 组件卸载时清理自动滚动定时器
	useEffect(() => {
		return () => stopAutoScroll()
	}, [])

	const startAutoScroll = (direction: 'up' | 'down') => {
		stopAutoScroll()
		autoScrollRef.current = setInterval(async () => {
			const delta = direction === 'down' ? SCROLL_SPEED : -SCROLL_SPEED
			const next = Math.max(0, scrollOffsetRef.current + delta)
			await listRef.current?.scrollToOffset({ offset: next, animated: false })
			scrollOffsetRef.current = next
		}, 16)
	}

	const updateDragPosition = (absoluteY: number) => {
		// Ghost: center it on the finger relative to the container
		ghostY.set(
			absoluteY - containerTopRef.current - SELECT_MODE_ITEM_HEIGHT / 2,
		)

		// Insert index: use calibration so that item-0 touches the origin correctly
		const hoverRel = absoluteY + scrollOffsetRef.current - dragOriginRef.current
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
	}

	const draggingRef = useRef(dragging)
	const insertAfterIndexRef = useRef(insertAfterIndex)
	useEffect(() => {
		draggingRef.current = dragging
	}, [dragging])
	useEffect(() => {
		insertAfterIndexRef.current = insertAfterIndex
	}, [insertAfterIndex])

	const handleDragStart = (
		trackIndex: number,
		trackId: number,
		absoluteY: number,
	) => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
		// Calibrate: store the virtual Y-origin so item i is at origin + i * H
		dragOriginRef.current =
			absoluteY + scrollOffsetRef.current - trackIndex * SELECT_MODE_ITEM_HEIGHT
		setDragging({ trackIndex, trackId })
		// Ghost starts centered on the finger
		ghostY.set(
			absoluteY - containerTopRef.current - SELECT_MODE_ITEM_HEIGHT / 2,
		)
		setInsertAfterIndex(trackIndex - 1)
	}

	const handleDragUpdate = updateDragPosition

	const handleDragEnd = () => {
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
				// 如果已经到了加载的末尾，且还有下一页，那么 prevSortKey 应该是下一页的第一条的 key
				const isAtEnd = clamped === allLoadedSortKeys.length - 1
				const nextPageFirstSortKey =
					playlistData?.pages[playlistData.pages.length - 1]
						?.nextPageFirstSortKey
				prevSortKey =
					allLoadedSortKeys[clamped + 1] ??
					(isAtEnd && hasNextPagePlaylistData ? nextPageFirstSortKey : null) ??
					null
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
	}

	const ghostAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: ghostY.value }],
	}))

	const draggedTrack =
		dragging !== null ? finalPlaylistData[dragging.trackIndex] : null

	const playlistActionsMenu = (
		<MenuView
			actions={[
				{ id: 'preference', title: '播放器偏好', image: PREFERRED_ICON },
				...(playlistMetadata.type === 'local' && !isSharedSubscriber
					? [{ id: 'sort', title: '排序', image: SORT_ICON }]
					: []),
				...(!isSharedSubscriber
					? [{ id: 'edit', title: '编辑播放列表信息', image: EDIT_ICON }]
					: []),
				...(playlistMetadata.type === 'local' &&
				playlistMetadata.validTrackCount < playlistMetadata.itemCount &&
				!isSharedSubscriber
					? [
							{
								id: 'clear-invalid',
								title: '清除失效视频',
								image: DELETE_ICON,
								attributes: { destructive: true },
							},
						]
					: []),
				...(playlistMetadata.type === 'local' &&
				playlistMetadata.remoteSyncId === null &&
				!isSharedSubscriber
					? [{ id: 'sync', title: '同步到 B 站', image: SYNC_ICON }]
					: []),
				...(playlistMetadata.type === 'local' && !playlistMetadata.shareId
					? [{ id: 'share', title: '设为共享歌单', image: SHARE_ICON }]
					: []),
				...(playlistMetadata.shareId
					? [{ id: 'share-settings', title: '共享设置', image: LINK_ICON }]
					: []),
				{
					id: 'pin',
					title: playlistMetadata.isPinned ? '取消置顶' : '置顶',
					image: playlistMetadata.isPinned ? UNPIN_ICON : PIN_ICON,
				},
				{
					id: 'delete',
					title: '删除播放列表',
					image: DELETE_ICON,
					attributes: { destructive: true },
				},
			]}
			onPressAction={({ nativeEvent }) => {
				const action = nativeEvent.event
				if (action === 'preference') setPlayerPreferenceVisible(true)
				if (action === 'sort') enterSelectMode()
				if (action === 'edit')
					openModal('EditPlaylistMetadata', { playlist: playlistMetadata })
				if (action === 'clear-invalid')
					alert(
						'清除失效视频',
						'确定从播放列表移除所有失效视频？',
						[
							{ text: '取消' },
							{ text: '确定', onPress: () => void clearInvalidVideos() },
						],
						{ cancelable: true },
					)
				if (action === 'sync')
					openModal(
						'SyncLocalToBilibili',
						{ playlistId: Number(id) },
						{ dismissible: false },
					)
				if (action === 'share')
					openModal('EnableSharing', { playlistId: Number(id) })
				if (action === 'share-settings')
					openModal('EnableSharing', {
						playlistId: Number(id),
						shareId: playlistMetadata.shareId,
						shareRole: playlistMetadata.shareRole,
					})
				if (action === 'pin')
					editPlaylistMetadata({
						playlistId: Number(id),
						payload: { isPinned: !playlistMetadata.isPinned },
					})
				if (action === 'delete')
					alert(
						'删除播放列表',
						deletePlaylistDialogPrompt(playlistMetadata, colors),
						[
							{ text: '取消' },
							{ text: '确定', onPress: onClickDeletePlaylist },
						],
						{ cancelable: true },
					)
			}}
		>
			<Appbar.Action icon='dots-vertical' />
		</MenuView>
	)

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<PlaylistPlayerPreferenceDialog
				playlist={playlistMetadata}
				visible={playerPreferenceVisible}
				onDismiss={() => setPlayerPreferenceVisible(false)}
			/>
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
						<Appbar.Action
							icon='select-all'
							disabled={isResolvingSelection}
							onPress={() => void selectAllTracks()}
						/>
						<Appbar.Action
							icon='select-compare'
							disabled={isResolvingSelection}
							onPress={() => void invertSelectedTracks()}
						/>
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
							disabled={isResolvingSelection}
							onPress={() => void openBatchAddTracksModal()}
						/>
					</>
				) : (
					<>
						{playlistMetadata.shareId && hasSyncFailures && (
							<Appbar.Action
								icon='alert-circle'
								color={colors.error}
								onPress={presentSyncFailuresSheet}
								accessibilityLabel='同步失败'
							/>
						)}
						{isPullingShared && (
							<Appbar.Action
								icon={pullingIcon}
								disabled
							/>
						)}
						<Appbar.Action
							icon={startSearch ? 'close' : 'magnify'}
							onPress={() => setStartSearch((prev) => !prev)}
						/>
						{playlistActionsMenu}
					</>
				)}
			</Appbar.Header>

			{/* 搜索框 */}
			<Animated.View
				style={[styles.searchbarContainer, searchbarAnimatedStyle]}
			>
				<SearchBar
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
					isSearching={startSearch}
					playableOfflineKeys={playableOfflineKeys}
					onEndReached={
						hasNextPagePlaylistData &&
						!startSearch &&
						!isFetchingNextPagePlaylistData
							? () => fetchNextPagePlaylistData()
							: undefined
					}
					onDragStart={
						selectMode &&
						playlistMetadata.type === 'local' &&
						!startSearch &&
						!isSharedSubscriber
							? handleDragStart
							: undefined
					}
					onDragUpdate={
						selectMode &&
						playlistMetadata.type === 'local' &&
						!startSearch &&
						!isSharedSubscriber
							? handleDragUpdate
							: undefined
					}
					onDragEnd={
						selectMode &&
						playlistMetadata.type === 'local' &&
						!startSearch &&
						!isSharedSubscriber
							? handleDragEnd
							: undefined
					}
					insertAfterIndex={dragging !== null ? insertAfterIndex : null}
					onViewableItemsChanged={handleViewableItemsChanged}
					viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
					onScroll={(e) => {
						scrollOffsetRef.current = e.nativeEvent.contentOffset.y
					}}
					ListHeaderComponent={
						<>
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
								shareMembers={shareMembers}
								onPressShareMember={handlePressShareMember}
								primaryButtonColor={primaryButtonColor}
								primaryButtonTextColor={primaryButtonTextColor}
								secondaryButtonContainerColor={secondaryButtonContainerColor}
								secondaryButtonIconColor={secondaryButtonIconColor}
							/>
							{isSharedLoggedOut && (
								<View
									style={[
										styles.syncPausedNotice,
										{ backgroundColor: colors.surfaceVariant },
									]}
								>
									<Text
										variant='bodyMedium'
										style={{ color: colors.onSurfaceVariant }}
									>
										登录 BBPlayer
										账号后才能使用共享同步功能。当前修改会保存在本地，并在下次登录后继续同步。
									</Text>
								</View>
							)}
						</>
					}
				/>
				{isCurrentTrackInPlaylist && !startSearch && !isCurrentTrackVisible && (
					<View style={styles.locateCurrentTrackButton}>
						<IconButton
							icon='crosshairs-gps'
							mode='contained'
							size={32}
							loading={isLocatingCurrentTrack}
							onPress={locateCurrentTrack}
							accessibilityLabel='定位到正在播放的歌曲'
							testID='local-playlist-scroll-to-current'
						/>
					</View>
				)}

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

			{membersSheetMounted && (
				<SharedPlaylistMembersSheet
					ref={setMembersSheetRef}
					shareId={playlistMetadata.shareId}
				/>
			)}
			{syncFailuresSheetMounted && (
				<SyncFailuresSheet
					ref={setSyncFailuresSheetRef}
					playlistId={playlistMetadata.id}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	searchbarContainer: { overflow: 'hidden' },
	locateCurrentTrackButton: {
		position: 'absolute',
		right: 16,
		bottom: 86,
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
	syncPausedNotice: {
		marginHorizontal: 16,
		marginBottom: 12,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
})
