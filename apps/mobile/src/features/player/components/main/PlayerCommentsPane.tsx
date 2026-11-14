import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import {
	CommentsList,
	CommentRepliesList,
} from '@/features/comments/components/CommentsList'
import { usePlayerCommentsPaneStore } from '@/hooks/stores/usePlayerCommentsPaneStore'

const closeComments = () => usePlayerCommentsPaneStore.getState().close()
const closeReply = () => usePlayerCommentsPaneStore.getState().closeReply()

/**
 * 宽屏播放器的评论侧边面板：覆盖在右栏歌词之上，从右侧滑入。
 * 开关状态放在独立的 store 中，展开 / 收起只会重渲染面板和入口按钮，
 * 不会牵动整个播放器页面。
 */
export function PlayerCommentsPane({ bvid }: { bvid: string | undefined }) {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const isOpen = usePlayerCommentsPaneStore((state) => state.isOpen && !!bvid)
	const replyId = usePlayerCommentsPaneStore((state) => state.replyId)

	// 首次展开时才挂载评论列表，收起后保留，再次展开不必重新加载。
	const [loadedBvid, setLoadedBvid] = useState<string | null>(null)

	if (isOpen && bvid && loadedBvid !== bvid) setLoadedBvid(bvid)

	// 评论跟随曲目：换歌或离开宽屏布局时收起面板。
	useEffect(
		() => () => {
			usePlayerCommentsPaneStore.setState({ isOpen: false, replyId: null })
		},
		[bvid],
	)

	const progress = useSharedValue(0)
	const sheetWidth = useSharedValue(0)

	useEffect(() => {
		progress.set(
			withTiming(isOpen ? 1 : 0, {
				duration: isOpen ? 300 : 220,
				easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
			}),
		)
	}, [isOpen, progress])

	const animatedStyle = useAnimatedStyle(() => ({
		// 测量到宽度前保持隐藏，避免首帧闪现在原位。
		opacity: progress.get() === 0 ? 0 : 1,
		transform: [{ translateX: (1 - progress.get()) * sheetWidth.get() }],
	}))

	return (
		<Animated.View
			style={[
				styles.sheet,
				// 面板底边让出系统手势条，避免内容被遮挡。
				{ backgroundColor: colors.elevation.level1, bottom: insets.bottom },
				animatedStyle,
			]}
			pointerEvents={isOpen ? 'auto' : 'none'}
			onLayout={(event) => sheetWidth.set(event.nativeEvent.layout.width)}
			testID='player-comments-pane'
			collapsable={false}
		>
			<View style={styles.header}>
				{replyId !== null && (
					<IconButton
						icon='arrow-left'
						onPress={closeReply}
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
					onPress={closeComments}
					accessibilityLabel='关闭评论'
					testID='player-comments-close'
				/>
			</View>
			{loadedBvid && (
				<>
					<View style={[styles.fill, replyId !== null && styles.hidden]}>
						<CommentsList
							bvid={loadedBvid}
							onReplyPress={(item) =>
								usePlayerCommentsPaneStore.getState().openReply(item.rpid)
							}
						/>
					</View>
					{replyId !== null && (
						<CommentRepliesList
							key={replyId}
							bvid={loadedBvid}
							rpid={replyId}
						/>
					)}
				</>
			)}
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	sheet: {
		...StyleSheet.absoluteFill,
		borderTopLeftRadius: 16,
		borderBottomLeftRadius: 16,
		paddingHorizontal: 8,
		elevation: 6,
		overflow: 'hidden',
	},
	header: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
	title: { flex: 1 },
	titleInset: { marginLeft: 16 },
	fill: { flex: 1 },
	hidden: { display: 'none' },
})
