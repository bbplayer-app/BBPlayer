import { LegendList } from '@legendapp/list/react-native'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Divider, Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import {
	useComments,
	useReplyComments,
} from '@/hooks/queries/bilibili/comments'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'

import { CommentItem } from './CommentItem'

interface CommentActions {
	bvid: string
	onReplyPress?: (item: BilibiliCommentItem) => void
}

const renderComment = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<BilibiliCommentItem, CommentActions>) => {
	if (!extraData) throw new Error('Extradata 不存在')

	return (
		<CommentItem
			item={item}
			bvid={extraData.bvid}
			onReplyPress={extraData.onReplyPress}
		/>
	)
}

const keyExtractor = (item: BilibiliCommentItem) => item.rpid.toString()
const separator = () => <Divider />

function CommentListContent({
	bvid,
	onReplyPress,
	query,
	rootComment,
	replies = false,
}: CommentActions & {
	query: ReturnType<typeof useComments> | ReturnType<typeof useReplyComments>
	rootComment?: BilibiliCommentItem
	replies?: boolean
}) {
	const { colors } = useTheme()

	const {
		data,
		isLoading,
		isError,
		isRefetching,
		refetch,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
	} = query

	const extraData = useMemo(
		() => ({ bvid, onReplyPress }),
		[bvid, onReplyPress],
	)

	const comments = useMemo(
		() => data?.pages.flatMap((page) => page.replies ?? []) ?? [],
		[data],
	)

	if (isLoading)
		return (
			<View style={styles.center}>
				<ActivityIndicator size='large' />
			</View>
		)

	if (isError && !data)
		return (
			<View style={styles.center}>
				<Text>评论加载失败</Text>
				<Button onPress={() => void refetch()}>重试</Button>
			</View>
		)

	return (
		<LegendList
			testID={replies ? 'comment-replies-list' : 'comments-list'}
			style={styles.list}
			data={comments}
			extraData={extraData}
			keyExtractor={keyExtractor}
			renderItem={renderComment}
			recycleItems
			ItemSeparatorComponent={separator}
			ListHeaderComponent={
				rootComment ? (
					<View
						style={{
							borderBottomWidth: StyleSheet.hairlineWidth,
							borderBottomColor: colors.outlineVariant,
						}}
					>
						<CommentItem
							item={rootComment}
							bvid={bvid}
						/>
					</View>
				) : null
			}
			onEndReached={() => {
				if (hasNextPage && !isFetchingNextPage && !query.isFetchNextPageError)
					void fetchNextPage()
			}}
			onEndReachedThreshold={0.5}
			ListFooterComponent={
				isFetchingNextPage ? (
					<ActivityIndicator style={styles.footer} />
				) : query.isFetchNextPageError ? (
					<Button onPress={() => void fetchNextPage()}>重试加载更多</Button>
				) : null
			}
			ListEmptyComponent={
				<Text style={styles.empty}>{replies ? '暂无回复' : '暂无评论'}</Text>
			}
			refreshing={isRefetching}
			onRefresh={() => void refetch()}
			contentContainerStyle={{ paddingBottom: 24 }}
		/>
	)
}

export function CommentsList(props: CommentActions) {
	const query = useComments(props.bvid)

	return (
		<CommentListContent
			{...props}
			query={query}
		/>
	)
}

export function CommentRepliesList({
	bvid,
	rpid,
}: {
	bvid: string
	rpid: number
}) {
	const query = useReplyComments(bvid, rpid)

	return (
		<CommentListContent
			bvid={bvid}
			query={query}
			rootComment={query.data?.pages[0]?.root}
			replies
		/>
	)
}

const styles = StyleSheet.create({
	list: { flex: 1 },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
	footer: { padding: 16 },
	empty: { textAlign: 'center', padding: 24 },
})
