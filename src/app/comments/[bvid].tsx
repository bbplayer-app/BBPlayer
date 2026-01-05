import { CommentItem } from '@/features/comments/components/CommentItem'
import { useComments } from '@/hooks/queries/bilibili/comments'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Appbar, Divider, Text, useTheme } from 'react-native-paper'

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	BilibiliCommentItem,
	{ bvid: string; onReplyPress: (item: BilibiliCommentItem) => void }
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const { bvid, onReplyPress } = extraData
	return (
		<CommentItem
			item={item}
			bvid={bvid}
			onReplyPress={onReplyPress}
		/>
	)
}

export default function CommentsPage() {
	const { bvid } = useLocalSearchParams<{ bvid: string }>()
	const theme = useTheme()
	const router = useRouter()
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch,
		isRefetching,
	} = useComments(bvid)

	const comments = data?.pages.flatMap((page) => page.replies ?? []) ?? []

	const onReplyPress = useCallback(
		(item: BilibiliCommentItem) => {
			router.push({
				pathname: '/comments/reply',
				params: { bvid: bvid, rpid: item.rpid },
			})
		},
		[bvid, router],
	)

	const extraData = useMemo(
		() => ({ bvid, onReplyPress }),
		[bvid, onReplyPress],
	)

	const keyExtractor = useCallback(
		(item: BilibiliCommentItem) => item.rpid.toString(),
		[],
	)

	const ItemSeparatorComponent = useCallback(() => <Divider />, [])

	if (!bvid) {
		return (
			<View style={styles.center}>
				<Text>参数错误</Text>
			</View>
		)
	}

	return (
		<View
			style={[styles.container, { backgroundColor: theme.colors.background }]}
		>
			<Appbar.Header elevated>
				<Appbar.Content title={'评论区'} />
				<Appbar.BackAction onPress={() => router.back()} />
			</Appbar.Header>
			{isLoading ? (
				<View style={styles.center}>
					<ActivityIndicator
						size='large'
						color={theme.colors.primary}
					/>
				</View>
			) : (
				<FlashList
					data={comments}
					extraData={extraData}
					keyExtractor={keyExtractor}
					renderItem={renderItem}
					onEndReached={() => {
						if (hasNextPage) void fetchNextPage()
					}}
					onEndReachedThreshold={0.5}
					ListFooterComponent={() =>
						isFetchingNextPage ? (
							<ActivityIndicator
								style={styles.footer}
								color={theme.colors.primary}
							/>
						) : null
					}
					refreshing={isRefetching}
					onRefresh={refetch}
					contentContainerStyle={{ paddingBottom: 20 }}
					ItemSeparatorComponent={ItemSeparatorComponent}
				/>
			)}
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
	footer: {
		padding: 16,
	},
})
