import FunctionalMenu from '@/components/common/FunctionalMenu'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistHeader } from '@/features/playlist/local/components/LocalPlaylistHeader'
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
} from '@/hooks/mutations/db/playlist'
import {
	usePlaylistContentsInfinite,
	usePlaylistMetadata,
	useSearchTracksInPlaylist,
} from '@/hooks/queries/db/playlist'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDebouncedValue } from '@/hooks/utils/useDebouncedValue'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import toast from '@/utils/toast'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Appbar, Menu, Portal, Searchbar, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SEARCHBAR_HEIGHT = 72
const SCOPE = 'UI.Playlist.Local'

export default function LocalPlaylistPage() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const dimensions = useWindowDimensions()
	const [searchQuery, setSearchQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const searchbarHeight = useSharedValue(0)
	const debouncedQuery = useDebouncedValue(searchQuery, 200)
	const { selected, selectMode, toggle, enterSelectMode, exitSelectMode } =
		useTrackSelection()
	const [batchAddTracksModalPayloads, setBatchAddTracksModalPayloads] =
		useState<{ track: CreateTrackPayload; artist: CreateArtistPayload }[]>([])
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
	const allLoadedTracks =
		playlistData?.pages.flatMap((page) => page.tracks) ?? []

	const {
		data: searchData,
		isError: isSearchError,
		error: searchError,
	} = useSearchTracksInPlaylist(Number(id), debouncedQuery, startSearch)

	const finalPlaylistData = (() => {
		if (!startSearch || !debouncedQuery.trim()) {
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

	const { mutate: syncPlaylist } = usePlaylistSync()
	const { mutate: deletePlaylist } = useDeletePlaylist()
	const { mutate: deleteTrackFromLocalPlaylist } =
		useBatchDeleteTracksFromLocalPlaylist()

	const onClickDeletePlaylist = useCallback(() => {
		deletePlaylist(
			{
				playlistId: Number(id),
			},
			{
				onSuccess: () => router.back(),
			},
		)
	}, [deletePlaylist, id, router])

	const handleSync = useCallback(() => {
		if (!playlistMetadata || !playlistMetadata.remoteSyncId) {
			toast.error(
				'无法同步，因为未找到播放列表元数据或\u2009remoteSyncId\u2009为空',
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
	}, [playlistMetadata, syncPlaylist])

	const { playAll, handleTrackPress } = useLocalPlaylistPlayer(Number(id))

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
			openModal('UpdateTrackLocalPlaylists', { track: track }),
		openEditTrackModal: (track) =>
			openModal('EditTrackMetadata', { track: track }),
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

	useEffect(() => {
		const payloads = []
		for (const trackId of selected) {
			const track = playlistData?.pages
				.flatMap((page) => page.tracks)
				.find((t) => t.id === trackId)
			if (!track) {
				toast.error(`批量添加歌曲失败：未找到\u2009track: ${trackId}`)
				return
			}
			payloads.push({
				track: {
					...track,
					artistId: track.artist?.id,
				},
				artist: track.artist!,
			})
		}
		setBatchAddTracksModalPayloads(payloads)
	}, [playlistData, selected])

	const searchbarAnimatedStyle = useAnimatedStyle(() => ({
		height: searchbarHeight.value,
	}))

	if (typeof id !== 'string') {
		return null
	}

	if (isPlaylistDataPending || isPlaylistMetadataPending) {
		return <PlaylistPageSkeleton />
	}

	if (isPlaylistDataError || isPlaylistMetadataError) {
		return <PlaylistError text='加载播放列表内容失败' />
	}

	if (!playlistMetadata) {
		return <PlaylistError text='未找到播放列表元数据' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title={
						selectMode
							? `已选择\u2009${selected.size}\u2009首`
							: playlistMetadata.title
					}
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

			<LocalTrackList
				tracks={finalPlaylistData ?? []}
				playlist={playlistMetadata}
				handleTrackPress={handleTrackPress}
				trackMenuItems={trackMenuItems}
				selectMode={selectMode}
				selected={selected}
				toggle={(trackId) => {
					void Haptics.performAndroidHapticsAsync(
						Haptics.AndroidHaptics.Clock_Tick,
					)
					toggle(trackId)
				}}
				enterSelectMode={(trackId) => {
					void Haptics.performAndroidHapticsAsync(
						Haptics.AndroidHaptics.Long_Press,
					)
					enterSelectMode(trackId)
				}}
				onEndReached={
					hasNextPagePlaylistData &&
					!startSearch &&
					!isFetchingNextPagePlaylistData
						? () => fetchNextPagePlaylistData()
						: undefined
				}
				ListHeaderComponent={
					<PlaylistHeader
						playlist={playlistMetadata}
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

			<Portal>
				<FunctionalMenu
					visible={functionalMenuVisible}
					onDismiss={() => setFunctionalMenuVisible(false)}
					anchor={{
						x: dimensions.width - 10,
						y: 60 + insets.top,
					}}
				>
					<Menu.Item
						onPress={() => {
							setFunctionalMenuVisible(false)
							openModal('EditPlaylistMetadata', { playlist: playlistMetadata })
						}}
						title='编辑播放列表信息'
						leadingIcon='pencil'
					/>
					<Menu.Item
						onPress={() => {
							setFunctionalMenuVisible(false)
							alert(
								'删除播放列表',
								'确定要删除此播放列表吗？',
								[
									{
										text: '取消',
									},
									{
										text: '确定',
										onPress: () => {
											onClickDeletePlaylist()
										},
									},
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
				<NowPlayingBar />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	searchbarContainer: {
		overflow: 'hidden',
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
