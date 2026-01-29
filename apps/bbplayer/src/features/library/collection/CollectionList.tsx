import { FlashList } from '@shopify/flash-list'
import { memo, useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Text, useTheme } from 'react-native-paper'

import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import TabDisable from '@/features/library/shared/TabDisabled'
import { CollectionListSkeleton } from '@/features/library/skeletons/LibraryTabSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useInfiniteCollectionsList } from '@/hooks/queries/bilibili/favorite'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import type { BilibiliCollection } from '@/types/apis/bilibili'

import CollectionListItem from './CollectionListItem'

const renderCollectionItem = ({ item }: { item: BilibiliCollection }) => (
	<CollectionListItem item={item} />
)

const CollectionListComponent = memo(() => {
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [refreshing, setRefreshing] = useState(false)
	const enable = useAppStore((state) => state.hasBilibiliCookie())

	const { data: userInfo } = usePersonalInformation()
	const {
		data: collections,
		isPending: collectionsIsPending,
		isError: collectionsIsError,
		isRefetching: collectionsIsRefetching,
		refetch,
		hasNextPage,
		fetchNextPage,
	} = useInfiniteCollectionsList(Number(userInfo?.mid))

	const keyExtractor = useCallback(
		(item: BilibiliCollection) => item.id.toString(),
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

	if (collectionsIsPending) {
		return <CollectionListSkeleton />
	}

	if (collectionsIsError) {
		return (
			<DataFetchingError
				text='加载失败'
				onRetry={() => onRefresh()}
			/>
		)
	}

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text
					variant='titleMedium'
					style={styles.headerTitle}
				>
					我的合集/收藏夹追更
				</Text>
				<Text variant='bodyMedium'>
					{collections.pages[0]?.count ?? 0}
					{'\u2009'}个追更
				</Text>
			</View>
			<FlashList
				data={collections.pages.flatMap((page) => page.list)}
				renderItem={renderCollectionItem}
				refreshControl={
					<RefreshControl
						refreshing={refreshing || collectionsIsRefetching}
						onRefresh={onRefresh}
						colors={[colors.primary]}
						progressViewOffset={50}
					/>
				}
				keyExtractor={keyExtractor}
				contentContainerStyle={{ paddingBottom: haveTrack ? 70 : 10 }}
				showsVerticalScrollIndicator={false}
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

CollectionListComponent.displayName = 'CollectionListComponent'

export default CollectionListComponent
