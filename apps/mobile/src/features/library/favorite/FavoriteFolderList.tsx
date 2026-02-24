import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { memo, useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Searchbar, Text, useTheme } from 'react-native-paper'

import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import TabDisable from '@/features/library/shared/TabDisabled'
import { FavoriteFolderListSkeleton } from '@/features/library/skeletons/LibraryTabSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetFavoritePlaylists } from '@/hooks/queries/bilibili/favorite'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import type { BilibiliPlaylist } from '@/types/apis/bilibili'

import FavoriteFolderListItem from './FavoriteFolderListItem'

const renderPlaylistItem = ({ item }: { item: BilibiliPlaylist }) => (
	<FavoriteFolderListItem item={item} />
)

const FavoriteFolderListComponent = memo(() => {
	const router = useRouter()
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [refreshing, setRefreshing] = useState(false)
	const [query, setQuery] = useState('')
	const enable = useAppStore((state) => state.hasBilibiliCookie())

	const { data: userInfo } = usePersonalInformation()
	const {
		data: playlists,
		isPending: playlistsIsPending,
		isRefetching: playlistsIsRefetching,
		refetch,
		isError: playlistsIsError,
	} = useGetFavoritePlaylists(userInfo?.mid)

	const keyExtractor = useCallback(
		(item: BilibiliPlaylist) => item.id.toString(),
		[],
	)

	const onRefresh = async () => {
		setRefreshing(true)
		await refetch()
		setRefreshing(false)
	}

	if (!enable) {
		return <TabDisable />
	}

	if (playlistsIsPending) {
		return <FavoriteFolderListSkeleton />
	}

	if (playlistsIsError) {
		return (
			<DataFetchingError
				text='加载失败'
				onRetry={() => onRefresh()}
			/>
		)
	}

	const filteredPlaylists = playlists.filter(
		(item) => !item.title.startsWith('[mp]'),
	)

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text
					variant='titleMedium'
					style={styles.headerTitle}
				>
					我的收藏夹
				</Text>
				<Text variant='bodyMedium'>
					{playlists.length ?? 0}&thinsp;个收藏夹
				</Text>
			</View>
			<Searchbar
				placeholder='搜索我的收藏夹内容'
				value={query}
				mode='bar'
				inputStyle={styles.searchInput}
				onChangeText={setQuery}
				style={styles.searchbar}
				onSubmitEditing={() => {
					setQuery('')
					router.push({
						pathname: '/playlist/remote/search-result/fav/[query]',
						params: { query },
					})
				}}
			/>
			<FlashList
				contentContainerStyle={{ paddingBottom: haveTrack ? 90 : 10 }}
				showsVerticalScrollIndicator={false}
				data={filteredPlaylists}
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
						style={styles.listFooter}
					>
						•
					</Text>
				}
				ListEmptyComponent={<Text style={styles.emptyList}>没有收藏夹</Text>}
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
	searchInput: {
		alignSelf: 'center',
	},
	searchbar: {
		borderRadius: 9999,
		textAlign: 'center',
		height: 45,
		marginBottom: 20,
		marginTop: 10,
	},
	listFooter: {
		textAlign: 'center',
		paddingTop: 10,
	},
	emptyList: {
		textAlign: 'center',
	},
})

FavoriteFolderListComponent.displayName = 'FavoriteFolderListComponent'

export default FavoriteFolderListComponent
