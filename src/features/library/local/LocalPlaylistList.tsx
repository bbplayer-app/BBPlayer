import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import { DataFetchingPending } from '@/features/library/shared/DataFetchingPending'
import { usePlaylistLists } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import type { Playlist } from '@/types/core/media'
import { FlashList } from '@shopify/flash-list'
import { memo, useCallback, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { IconButton, Text, useTheme } from 'react-native-paper'
import LocalPlaylistItem from './LocalPlaylistItem'

const renderPlaylistItem = ({ item }: { item: Playlist }) => (
	<LocalPlaylistItem item={item} />
)

const LocalPlaylistListComponent = memo(() => {
	const { colors } = useTheme()
	const haveTrack = usePlayerStore((state) => !!state.currentTrackUniqueKey)
	const [refreshing, setRefreshing] = useState(false)
	const openModal = useModalStore((state) => state.open)

	const {
		data: playlists,
		isPending: playlistsIsPending,
		isRefetching: playlistsIsRefetching,
		refetch,
		isError: playlistsIsError,
	} = usePlaylistLists()

	const keyExtractor = useCallback((item: Playlist) => item.id.toString(), [])

	const onRefresh = async () => {
		setRefreshing(true)
		await refetch()
		setRefreshing(false)
	}

	if (playlistsIsPending) {
		return <DataFetchingPending />
	}

	if (playlistsIsError) {
		return (
			<DataFetchingError
				text='加载失败'
				onRetry={() => onRefresh()}
			/>
		)
	}

	return (
		<View style={{ flex: 1, marginHorizontal: 16 }}>
			<View
				style={{
					marginBottom: 8,
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<Text
					variant='titleMedium'
					style={{ fontWeight: 'bold' }}
				>
					播放列表
				</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<Text variant='bodyMedium'>{playlists.length ?? 0} 个播放列表</Text>
					<IconButton
						icon='plus'
						size={20}
						onPress={() => {
							openModal('CreatePlaylist', { redirectToNewPlaylist: true })
						}}
					/>
				</View>
			</View>
			<FlashList
				contentContainerStyle={{ paddingBottom: haveTrack ? 70 : 10 }}
				showsVerticalScrollIndicator={false}
				data={playlists ?? []}
				renderItem={renderPlaylistItem}
				refreshControl={
					<RefreshControl
						refreshing={refreshing || playlistsIsRefetching}
						onRefresh={onRefresh}
						colors={[colors.primary]}
						progressViewOffset={50}
					/>
				}
				keyExtractor={keyExtractor}
				ListFooterComponent={
					<Text
						variant='titleMedium'
						style={{ textAlign: 'center', paddingTop: 10 }}
					>
						•
					</Text>
				}
				ListEmptyComponent={
					<Text style={{ textAlign: 'center' }}>没有播放列表</Text>
				}
			/>
		</View>
	)
})

LocalPlaylistListComponent.displayName = 'LocalPlaylistListComponent'

export default LocalPlaylistListComponent
