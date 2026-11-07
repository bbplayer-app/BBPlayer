import { TvFocusScope } from '@bbplayer/native'
import { useState } from 'react'
import type { ViewStyle } from 'react-native'
import { Pressable, StyleSheet } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useTheme } from 'react-native-paper'
import {
	createAnimatedComponent,
	useAnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
	visible: boolean
	onDismiss: () => void
	children?: React.ReactNode
	contentStyle?: ViewStyle
}

const AnimatedPressable = createAnimatedComponent(Pressable)

export default function AnimatedModalOverlay({
	visible,
	onDismiss,
	children,
	contentStyle,
}: Props) {
	const insets = useSafeAreaInsets()
	const { height } = useReanimatedKeyboardAnimation()
	const theme = useTheme()
	const [showContent, setShowContent] = useState(false)

	const wrapperAvoiding = useAnimatedStyle(() => {
		const k = Math.max(0, Math.abs(height.value) - insets.bottom)
		return { paddingBottom: k }
	})

	if (!visible) return null

	return (
		// 遥控器操作时焦点留在弹窗内，关闭后回到打开它的按钮。
		<TvFocusScope style={styles.focusScope}>
			<AnimatedPressable
				style={[styles.wrapper, wrapperAvoiding]}
				onPress={onDismiss}
				// 遮罩和内容容器只为触摸服务，不能成为遥控器的焦点。
				focusable={false}
			>
				<Pressable
					style={[
						styles.content,
						{
							marginHorizontal: Math.max(insets.left, insets.right, 26),
							opacity: showContent ? 1 : 0,
						},
					]}
					onLayout={(e) => {
						setShowContent(
							e.nativeEvent.layout.height > 0 && e.nativeEvent.layout.width > 0,
						)
					}}
					onPress={(e) => e.stopPropagation()}
					focusable={false}
				>
					<SquircleView
						style={[
							styles.contentInner,
							{ backgroundColor: theme.colors.surface },
							contentStyle,
						]}
						cornerSmoothing={0.6}
					>
						{children}
					</SquircleView>
				</Pressable>
			</AnimatedPressable>
		</TvFocusScope>
	)
}

const styles = StyleSheet.create({
	focusScope: {
		...StyleSheet.absoluteFill,
		zIndex: 1000,
	},
	wrapper: {
		...StyleSheet.absoluteFill,
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.5)',
		zIndex: 1000,
	},
	content: {
		maxHeight: '85%',
	},
	contentInner: {
		paddingTop: 10,
		elevation: 24,
		borderRadius: 32,
		overflow: 'hidden',
	},
})
