import { CommentItem } from '@/features/comments/components/CommentItem'
import { useReplyComments } from '@/hooks/queries/bilibili/comments'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<BilibiliCommentItem, { bvid: string }>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const { bvid } = extraData
	return (
		<CommentItem
			item={item}
			bvid={bvid}
		/>
	)
}

export default function ReplyCommentsPage() {
	const { bvid, rpid } = useLocalSearchParams<{ bvid: string; rpid: string }>()
	const theme = useTheme()
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch,
		isRefetching,
	} = useReplyComments(bvid, Number(rpid))
	const router = useRouter()

	const replies = data?.pages.flatMap((page) => page.replies ?? []) ?? []
	const rootComment = data?.pages[0]?.root

	const extraData = useMemo(() => ({ bvid }), [bvid])

	const keyExtractor = useCallback(
		(item: BilibiliCommentItem) => item.rpid.toString(),
		[],
	)

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
					data={replies}
					extraData={extraData}
					keyExtractor={keyExtractor}
					ListHeaderComponent={() =>
						rootComment ? (
							<View
								style={{
									borderBottomWidth: 1,
									borderBottomColor: theme.colors.outlineVariant,
								}}
							>
								<CommentItem
									item={rootComment}
									bvid={bvid}
								/>
							</View>
						) : null
					}
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
