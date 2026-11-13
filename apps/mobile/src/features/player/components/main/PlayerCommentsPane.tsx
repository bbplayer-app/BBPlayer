import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import {
	CommentsList,
	CommentRepliesList,
} from '@/features/comments/components/CommentsList'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'

export function PlayerCommentsPane({
	bvid,
	replyId,
	onReplyPress,
	onBack,
	onClose,
}: {
	bvid: string
	replyId: number | null
	onReplyPress: (item: BilibiliCommentItem) => void
	onBack: () => void
	/** 关闭评论面板，回到歌词。 */
	onClose: () => void
}) {
	return (
		<View
			style={{ flex: 1, minHeight: 0 }}
			testID='player-comments-pane'
			collapsable={false}
		>
			<View style={styles.header}>
				{replyId !== null && (
					<IconButton
						icon='arrow-left'
						onPress={onBack}
						accessibilityLabel='返回评论列表'
						testID='player-comments-back'
					/>
				)}
				<Text
					variant='titleMedium'
					style={[styles.title, replyId === null && styles.titleInset]}
				>
					{replyId !== null ? '评论回复' : '评论'}
				</Text>
				<IconButton
					icon='close'
					onPress={onClose}
					accessibilityLabel='关闭评论'
					testID='player-comments-close'
				/>
			</View>
			<View style={{ flex: 1, display: replyId !== null ? 'none' : 'flex' }}>
				<CommentsList
					bvid={bvid}
					onReplyPress={onReplyPress}
				/>
			</View>
			{replyId !== null && (
				<CommentRepliesList
					key={replyId}
					bvid={bvid}
					rpid={replyId}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	header: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
	title: { flex: 1 },
	titleInset: { marginLeft: 8 },
})
