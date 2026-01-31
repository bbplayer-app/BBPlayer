import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Appbar, Text, TouchableRipple, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { useExternalPlaylistSyncStore } from '@/hooks/stores/useExternalPlaylistSyncStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useExternalPlaylist } from '@/hooks/useExternalPlaylist'
import { externalPlaylistService } from '@/lib/services/externalPlaylistService'
import type { GenericTrack } from '@/types/external_playlist'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'

const SyncTrackItem = memo(
	({
		index,
		track,
		onPress,
	}: {
		index: number
		track: GenericTrack
		onPress: () => void
	}) => {
		const theme = useTheme()
		const result = useExternalPlaylistSyncStore((state) => state.results[index])

		const statusColor = result
			? result.matchedVideo
				? theme.colors.primary
				: theme.colors.error
			: theme.colors.onSurfaceVariant

		return (
			<View style={styles.itemContainer}>
				<TouchableRipple
					onPress={onPress}
					style={{ flex: 1 }}
				>
					<View style={styles.itemInner}>
						<View style={styles.itemContent}>
							<Text
								variant='titleMedium'
								numberOfLines={1}
							>
								{track.title}
							</Text>
							<Text
								variant='bodySmall'
								style={{ color: theme.colors.outline }}
							>
								{track.artists.join(', ')} - {track.album}
							</Text>
						</View>
						<View style={styles.statusContainer}>
							{result ? (
								<Text style={{ color: statusColor, fontWeight: 'bold' }}>
									{result.matchedVideo ? '已匹配' : '未找到'}
								</Text>
							) : (
								<Text style={{ color: statusColor }}>等待中</Text>
							)}
						</View>
					</View>
				</TouchableRipple>
			</View>
		)
	},
)
SyncTrackItem.displayName = 'SyncTrackItem'

const renderItem = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<
	GenericTrack,
	{
		openManualMatch: (track: GenericTrack, index: number) => void
	}
>) => {
	if (!extraData) return null
	return (
		<SyncTrackItem
			index={index}
			track={item}
			onPress={() => extraData.openManualMatch(item, index)}
		/>
	)
}

export default function ExternalPlaylistSyncPage() {
	const { id, source } = useLocalSearchParams<{
		id: string
		source: 'netease' | 'qq'
	}>()
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)

	const { data, isLoading, error } = useExternalPlaylist(
		id ?? '',
		source ?? 'netease',
	)

	const { setSyncing, setProgress, setResult, reset, syncing, progress } =
		useExternalPlaylistSyncStore()

	// Reset store on mount
	useEffect(() => {
		reset()
		return () => reset()
	}, [reset])

	const handleSync = useCallback(async () => {
		if (!data?.tracks) return
		setSyncing(true)
		setProgress(0, 1)

		const result = await externalPlaylistService.matchExternalPlaylist(
			data.tracks,
			(current, total, matchResult) => {
				// Index is current - 1 because current starts at 1
				setResult(current - 1, matchResult)
				setProgress(current, total)
			},
		)

		setSyncing(false)
		if (result.isErr()) {
			console.error(result.error)
		}
	}, [data?.tracks, setProgress, setResult, setSyncing])

	const handleOpenManualMatch = useCallback(
		(track: GenericTrack, index: number) => {
			openModal('ManualMatchExternalSync', {
				track,
				index,
				initialQuery: `${track.title} - ${track.artists.join(' ')}`,
			})
		},
		[openModal],
	)

	if (isLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator
					size='large'
					color={theme.colors.primary}
				/>
			</View>
		)
	}

	if (error || !data) {
		return (
			<View style={styles.center}>
				<Text style={{ color: theme.colors.error }}>
					加载失败: {error?.message ?? '未知错误'}
				</Text>
			</View>
		)
	}

	const { playlist, tracks } = data

	return (
		<View
			style={[styles.container, { backgroundColor: theme.colors.background }]}
		>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title={
						syncing ? `同步中 ${(progress * 100).toFixed(0)}%` : '歌单同步'
					}
				/>
			</Appbar.Header>

			<FlashList
				data={tracks}
				renderItem={renderItem}
				extraData={{ openManualMatch: handleOpenManualMatch }}
				keyExtractor={(item, index) => `${index}-${item.title}`}
				contentContainerStyle={{
					paddingBottom: insets.bottom,
				}}
				ListHeaderComponent={
					<PlaylistHeader
						id={playlist.id}
						coverUri={playlist.coverUrl}
						title={playlist.title}
						description={playlist.description}
						subtitles={[
							`${playlist.author.name}`,
							`${playlist.trackCount} 首歌曲`,
						]}
						mainButtonIcon='sync'
						mainButtonText={syncing ? '同步中...' : '开始同步'}
						onClickMainButton={handleSync}
					/>
				}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	itemContainer: {
		flexDirection: 'column',
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#ccc',
	},
	itemInner: {
		flexDirection: 'row',
		padding: 16,
		alignItems: 'center',
	},
	itemContent: {
		flex: 1,
	},
	statusContainer: {
		marginLeft: 16,
	},
})
