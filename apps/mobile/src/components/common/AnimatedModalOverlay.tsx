import { useState } from 'react'
import type { ViewStyle } from 'react-native'
import { Pressable, StyleSheet } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useTheme } from 'react-native-paper'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
	visible: boolean
	onDismiss: () => void
	children?: React.ReactNode
	contentStyle?: ViewStyle
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

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
		<AnimatedPressable
			style={[styles.wrapper, wrapperAvoiding]}
			onPress={onDismiss}
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
	)
}

const styles = StyleSheet.create({
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
