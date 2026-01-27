import NowPlayingBar from '@/components/NowPlayingBar'
import { SyncProgressModal } from '@/components/SyncProgressModal'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import useCheckLinkedToPlaylist from '@/features/playlist/remote/hooks/useCheckLinkedToLocalPlaylist'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { usePlaylistSync } from '@/hooks/mutations/db/playlist'
import { useInfiniteFavoriteList } from '@/hooks/queries/bilibili/favorite'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { bv2av } from '@/lib/api/bilibili/utils'
import type { SyncProgress } from '@/lib/facades/sync'
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
	}
}

export default function FavoritePage() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { colors } = useTheme()
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
	const [isSyncModalVisible, setIsSyncModalVisible] = useState(false)
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

		setIsSyncModalVisible(true)
		syncFavorite(
			{
				remoteSyncId: Number(id),
				type: 'favorite',
				onProgress: setSyncProgress,
			},
			{
				onSuccess: (id) => {
					setSyncProgress((prev) =>
						prev ? { ...prev, stage: 'completed', message: '同步完成' } : null,
					)
					// 等待用户点击关闭或自动关闭逻辑
					// 这里我们不自动跳转，让用户看到结果
					if (!id) return
					// 如果需要自动跳转，可以在 onClose 里处理，或者这里延迟处理
				},
				onError: (error) => {
					setSyncProgress((prev) =>
						prev
							? {
									...prev,
									stage: 'error',
									message: `同步失败: ${error.message}`,
								}
							: null,
					)
				},
			},
		)
	}, [favoriteData?.pages, id, syncFavorite])

	useEffect(() => {
		if (typeof id !== 'string') {
			router.replace('/+not-found')
		}
	}, [id, router])

	if (typeof id !== 'string') {
		return null
	}

	if (isFavoriteDataPending) {
		return <PlaylistPageSkeleton />
	}

	if (isFavoriteDataError) {
		return (
			<PlaylistError
				text='加载收藏夹内容失败'
				onRetry={refetch}
			/>
		)
	}

	if (!favoriteData.pages[0].info) {
		return (
			<PlaylistError
				text='收藏夹信息无效或不存在'
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
							? `已选择\u2009${selected.size}\u2009首`
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
							subtitles={`${favoriteData.pages[0].info.upper.name}\u2009•\u2009${favoriteData.pages[0].info.media_count}\u2009首歌曲`}
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
			<SyncProgressModal
				visible={isSyncModalVisible}
				progress={syncProgress}
				onClose={() => {
					setIsSyncModalVisible(false)
					setSyncProgress(null)
					if (syncProgress?.stage === 'completed' && linkedPlaylistId) {
						// 如果同步完成，跳转或者刷新
						// 用户之前逻辑是 replace 到 local playlist，这里我们可以保持或者不做
						// 考虑到 syncFavorite mutation onSuccess 已经 invalidate 了 queries，
						// 如果用户想去看本地列表，可以引导。但这之前直接 replace 有点突兀？
						// 原逻辑：
						/*
                         router.replace({
                            pathname: '/playlist/local/[id]',
                            params: { id: String(id) }, // 注意这里 id 拿不到了，除非存起来
                         })
                         */
						// 既然 mutation invalidate 了，这里其实也可以不动。
						// 但为了保留原逻辑的体验（同步完跳转），我们需要知道 playlistId。
						// 目前 hook 的 onSuccess 已经拿不到最新的 playlistId 了吗？
						// mutation 的 onSuccess 是有 playlistId 的。
						// 我们在 component 的 onSuccess 只是更新了 progress。
						// 简单处理：同步完成后，用户关闭 Modal。如果需要跳转，在此刻可能拿不到 id。
						// 除非我们在 component state 里再存一个 resultId。
						// 暂时不做自动跳转，因为 Modal 关闭是用户主动操作，而且原来的 refresh 也只是 replace。
						// 重新 checkLinked 应该不仅仅需要 updated，可能需要 refetch。
						// linkedPlaylistId 是 hook 查出来的。
					}
				}}
			/>
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
