import { View } from 'react-native'
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
}: {
	bvid: string
	replyId: number | null
	onReplyPress: (item: BilibiliCommentItem) => void
	onBack: () => void
}) {
	return (
		<View
			style={{ flex: 1, minHeight: 0 }}
			testID='player-comments-pane'
			collapsable={false}
		>
			{replyId !== null && (
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<IconButton
						icon='arrow-left'
						onPress={onBack}
						accessibilityLabel='返回评论列表'
						testID='player-comments-back'
					/>
					<Text variant='titleMedium'>评论回复</Text>
				</View>
			)}
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
