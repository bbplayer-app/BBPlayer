import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'

import { CommentsList } from '@/features/comments/components/CommentsList'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'

export default function CommentsPage() {
	const { bvid } = useLocalSearchParams<{ bvid: string }>()
	const { colors } = useTheme()
	const router = useRouter()

	const onReplyPress = useCallback(
		(item: BilibiliCommentItem) => {
			router.navigate({
				pathname: '/comments/reply',
				params: { bvid, rpid: item.rpid },
			})
		},
		[bvid, router],
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='评论区' />
			</Appbar.Header>
			{bvid ? (
				<CommentsList
					bvid={bvid}
					onReplyPress={onReplyPress}
				/>
			) : (
				<Text>参数错误</Text>
			)}
		</View>
	)
}

const styles = StyleSheet.create({ container: { flex: 1 } })
