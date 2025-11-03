import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import { DataFetchingPending } from '@/features/library/shared/DataFetchingPending'
import TabDisable from '@/features/library/shared/TabDisabled'
import {
	useGetFavoritePlaylists,
	useInfiniteFavoriteList,
} from '@/hooks/queries/bilibili/favorite'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import { FlashList } from '@shopify/flash-list'
import { memo, useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Text, useTheme } from 'react-native-paper'
import MultiPageVideosItem from './MultiPageVideosItem'

const renderPlaylistItem = ({
	item,
}: {
	item: BilibiliFavoriteListContent
}) => <MultiPageVideosItem item={item} />

const MultiPageVideosListComponent = memo(() => {
	const { colors } = useTheme()
	const haveTrack = usePlayerStore((state) => !!state.currentTrackUniqueKey)
	const [refreshing, setRefreshing] = useState(false)
	const enable = useAppStore((state) => state.hasBilibiliCookie())

	const { data: userInfo } = usePersonalInformation()
	const {
		data: playlists,
		isPending: playlistsIsPending,
		isError: playlistsIsError,
		isRefetching: playlistsIsRefetching,
		refetch: refetchPlaylists,
	} = useGetFavoritePlaylists(userInfo?.mid)
	const {
		data: favoriteData,
		isError: isFavoriteDataError,
		isPending: isFavoriteDataPending,
		isRefetching: isFavoriteDataRefetching,
		fetchNextPage,
		refetch: refetchFavoriteData,
		hasNextPage,
	} = useInfiniteFavoriteList(
		playlists?.find((item) => item.title.startsWith('[mp]'))?.id,
	)

	const keyExtractor = useCallback(
		(item: BilibiliFavoriteListContent) => item.bvid,
		[],
	)

	const onRefresh = async () => {
		setRefreshing(true)
		await Promise.all([refetchPlaylists(), refetchFavoriteData()])
		setRefreshing(false)
	}

	if (!enable) {
		return <TabDisable />
	}

	if (playlistsIsPending || isFavoriteDataPending) {
		return <DataFetchingPending />
	}

	if (playlistsIsError || isFavoriteDataError) {
		return (
			<DataFetchingError
				text='加载失败'
				onRetry={() => onRefresh()}
			/>
		)
	}

	if (!playlists?.find((item) => item.title.startsWith('[mp]'))) {
		return (
			<View style={styles.noMpContainer}>
				<Text
					variant='titleMedium'
					style={styles.noMpText}
				>
					未找到分 p 视频收藏夹，请先创建一个收藏夹，并以 [mp] 开头
				</Text>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text
					variant='titleMedium'
					style={styles.headerTitle}
				>
					分P视频
				</Text>
				<Text variant='bodyMedium'>
					{favoriteData.pages[0]?.info?.media_count ?? 0} 个分P视频
				</Text>
			</View>
			<FlashList
				contentContainerStyle={{ paddingBottom: haveTrack ? 70 : 10 }}
				showsVerticalScrollIndicator={false}
				data={favoriteData.pages.flatMap((page) => page.medias ?? []) ?? []}
				renderItem={renderPlaylistItem}
				keyExtractor={keyExtractor}
				refreshControl={
					<RefreshControl
						refreshing={
							refreshing || playlistsIsRefetching || isFavoriteDataRefetching
						}
						onRefresh={onRefresh}
						colors={[colors.primary]}
						progressViewOffset={50}
					/>
				}
				ListEmptyComponent={<Text style={styles.emptyList}>没有分P视频</Text>}
				onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
				ListFooterComponent={
					hasNextPage ? (
						<View style={styles.footerLoadingContainer}>
							<ActivityIndicator size='small' />
						</View>
					) : (
						<Text
							variant='titleMedium'
							style={styles.footerReachedEnd}
						>
							•
						</Text>
					)
				}
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		marginHorizontal: 16,
	},
	headerContainer: {
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerTitle: {
		fontWeight: 'bold',
	},
	noMpContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	noMpText: {
		textAlign: 'center',
	},
	emptyList: {
		textAlign: 'center',
	},
	footerLoadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	footerReachedEnd: {
		textAlign: 'center',
		paddingTop: 10,
	},
})

MultiPageVideosListComponent.displayName = 'MultiPageVideosListComponent'

export default MultiPageVideosListComponent
