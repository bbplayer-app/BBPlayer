import * as Clipboard from 'expo-clipboard'
import { useImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Avatar,
	Divider,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { useSubscribeToSharedPlaylist } from '@/hooks/mutations/db/playlist'
import { useSharedPlaylistPreview } from '@/hooks/queries/sharedPlaylistPreview'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { bv2av } from '@/lib/api/bilibili/utils'
import type { SharedPlaylistPreview } from '@/lib/facades/sharedPlaylist'
import type { BilibiliTrack } from '@/types/core/media'
import toast from '@/utils/toast'

const mapPreviewTrackToBilibiliTrack = (
	track: SharedPlaylistPreview['tracks'][number],
	index: number,
	now: Date,
): BilibiliTrack => {
	const baseId = Number(bv2av(track.bilibili_bvid))
	const cidNum = track.bilibili_cid ? Number(track.bilibili_cid) : undefined
	const id = Number.isFinite(baseId)
		? baseId * 1000 + (cidNum ?? 0) + index
		: index + 1
	const artistRemoteId = track.artist_id ?? null
	const artistNumericId = artistRemoteId ? Number(artistRemoteId) : undefined

	return {
		id,
		uniqueKey: track.unique_key,
		title: track.title,
		artist:
			track.artist_name && track.artist_name.length > 0
				? {
						id: Number.isFinite(artistNumericId) ? artistNumericId! : id * 10,
						name: track.artist_name,
						avatarUrl: null,
						source: 'bilibili',
						remoteId: artistRemoteId,
						createdAt: now,
						updatedAt: now,
					}
				: null,
		coverUrl: track.cover_url ?? null,
		source: 'bilibili',
		createdAt: now,
		updatedAt: now,
		duration: track.duration ?? 0,
		bilibiliMetadata: {
			bvid: track.bilibili_bvid,
			cid: cidNum ?? null,
			isMultiPage: !!track.bilibili_cid,
			videoIsValid: true,
		},
	}
}

const trackMenuItems = () => []

export default function SharedPlaylistPreviewPage() {
	const { shareId, inviteCode } = useLocalSearchParams<{
		shareId?: string
		inviteCode?: string
	}>()
	const router = useRouter()
	const theme = useTheme()
	const { colors } = theme
	const [refreshing, setRefreshing] = useState(false)
	const parsedShareId = typeof shareId === 'string' ? shareId : undefined
	const parsedInviteCode =
		typeof inviteCode === 'string' ? inviteCode : undefined

	useEffect(() => {
		if (!parsedShareId) {
			router.replace('/+not-found')
		}
	}, [parsedShareId, router])

	const { data, isPending, isError, refetch } =
		useSharedPlaylistPreview(parsedShareId)

	const { mutate: subscribe, isPending: isSubscribing } =
		useSubscribeToSharedPlaylist()

	const selection = {
		active: false,
		selected: new Set<number>(),
		toggle: () => void 0,
		enter: () => void 0,
	}

	const [showFullTitle, setShowFullTitle] = useState(false)
	const { playTrack } = useRemotePlaylist()
	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop<BilibiliTrack>()

	const coverRef = useImage(data?.playlist.coverUrl ?? '', {
		onError: () => void 0,
	})
	const { backgroundColor, nowPlayingBarColor } = usePlaylistBackgroundColor(
		coverRef,
		theme.dark,
		colors.background,
	)

	const nowForTracks = new Date()
	const previewTracks = data
		? data.tracks.map((t, idx) =>
				mapPreviewTrackToBilibiliTrack(t, idx, nowForTracks),
			)
		: []

	const subtitleParts: string[] = []
	if (data) {
		subtitleParts.push(`${data.playlist.trackCount} 首歌曲`)
	}

	const handleSubscribe = () => {
		if (!parsedShareId) return
		subscribe({ shareId: parsedShareId, inviteCode: parsedInviteCode })
	}

	if (!parsedShareId) return null

	if (isPending) {
		return <PlaylistPageSkeleton />
	}

	if (isError || !data) {
		return (
			<PlaylistError
				text='加载共享歌单失败'
				onRetry={refetch}
			/>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.Content
					title={data.playlist.title}
					onPress={handleDoubleTap}
				/>
				<Appbar.BackAction onPress={() => router.back()} />
			</Appbar.Header>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={previewTracks}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					ListHeaderComponent={
						<>
							<View style={styles.playlistHeader}>
								{/* 封面 + 文字列 */}
								<View style={styles.headerContainer}>
									<CoverWithPlaceHolder
										id={data.playlist.id}
										cover={coverRef ?? undefined}
										title={data.playlist.title}
										size={120}
									/>
									<View style={styles.headerTextContainer}>
										<TouchableRipple
											onPress={() => setShowFullTitle(!showFullTitle)}
											onLongPress={async () => {
												const ok = await Clipboard.setStringAsync(
													data.playlist.title,
												)
												if (!ok) toast.error('复制失败')
												else toast.success('已复制标题到剪贴板')
											}}
										>
											<Text
												variant='titleLarge'
												style={styles.headerTitle}
												numberOfLines={showFullTitle ? undefined : 2}
											>
												{data.playlist.title}
											</Text>
										</TouchableRipple>
										<Text variant='bodyMedium'>
											{subtitleParts.join(' • ')}
										</Text>
										{data.owner && (
											<View style={styles.shareInfoRow}>
												{data.owner.avatarUrl ? (
													<Avatar.Image
														size={24}
														source={{ uri: data.owner.avatarUrl }}
													/>
												) : (
													<Avatar.Text
														size={24}
														label={data.owner.name.slice(0, 1)}
													/>
												)}
												<Text
													variant='bodySmall'
													numberOfLines={1}
													style={styles.shareOwnerName}
												>
													{data.owner.name}
												</Text>
											</View>
										)}
									</View>
								</View>
								{/* 订阅按钮 */}
								<View style={styles.actionsContainer}>
									<Button
										mode='contained'
										icon='account-plus'
										onPress={handleSubscribe}
										loading={isSubscribing}
										disabled={isSubscribing}
										testID='playlist-header-main-button'
									>
										订阅共享歌单
									</Button>
								</View>
								{/* 描述 */}
								<Text
									variant='bodyMedium'
									style={[
										styles.description,
										!!data.playlist.description && styles.descriptionMargin,
									]}
								>
									{data.playlist.description ?? ''}
								</Text>
								<Divider />
							</View>
							{data.playlist.trackCount > data.previewLimit && (
								<Text
									variant='bodySmall'
									style={styles.previewHint}
								>
									仅展示前 {data.previewLimit} 首，订阅后会自动拉取完整曲目。
								</Text>
							)}
						</>
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
	previewHint: {
		marginHorizontal: 16,
		marginTop: 12,
		marginBottom: 12,
	},
	playlistHeader: {
		flexDirection: 'column',
	},
	headerContainer: {
		flexDirection: 'row',
		padding: 16,
		alignItems: 'center',
	},
	headerTextContainer: {
		marginLeft: 16,
		flex: 1,
		justifyContent: 'center',
	},
	headerTitle: {
		fontWeight: 'bold',
	},
	actionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		marginHorizontal: 16,
	},
	description: {
		margin: 0,
	},
	descriptionMargin: {
		margin: 16,
	},
	shareInfoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		columnGap: 6,
		marginTop: 8,
	},
	shareOwnerName: {
		fontWeight: '600',
	},
})
