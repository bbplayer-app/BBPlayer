import type { LyricSpan } from '@bbplayer/splash'
import { memo } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
	createAnimatedComponent,
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated'

const AnimatedText = createAnimatedComponent(Text)

interface KaraokeWordProps {
	span: LyricSpan
	currentTime: SharedValue<number>
	baseStyle?: StyleProp<TextStyle>
	activeColor: string
	inactiveColor: string
}

export const KaraokeWord = memo(function KaraokeWord({
	span,
	currentTime,
	baseStyle,
	activeColor,
	inactiveColor,
}: KaraokeWordProps) {
	const localProgress = useSharedValue(0)
	const layoutWidth = useSharedValue(0)

	useAnimatedReaction(
		() => currentTime.value,
		(currentVal: number) => {
			const timeMs = currentVal * 1000
			if (timeMs < span.startTime) {
				localProgress.set(0)
			} else if (timeMs > span.endTime) {
				localProgress.set(1)
			} else {
				localProgress.set(
					interpolate(
						timeMs,
						[span.startTime, span.endTime],
						[0, 1],
						Extrapolation.CLAMP,
					),
				)
			}
		},
		[span],
	)

	const maskStyle = useAnimatedStyle(() => {
		return {
			width: layoutWidth.value * localProgress.value,
			opacity: currentTime.value >= 0 ? 1 : 0,
		}
	})

	const activeTextStyle = useAnimatedStyle(() => {
		return {
			width: layoutWidth.value,
			color: activeColor,
		}
	})

	return (
		<View
			style={styles.container}
			onLayout={(e) => {
				layoutWidth.set(e.nativeEvent.layout.width)
			}}
		>
			<Text
				style={[baseStyle, { color: inactiveColor }]}
				numberOfLines={1}
			>
				{span.text}
			</Text>

			<Animated.View style={[styles.mask, maskStyle]}>
				<AnimatedText
					style={[baseStyle, activeTextStyle]}
					numberOfLines={1}
				>
					{span.text}
				</AnimatedText>
			</Animated.View>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		justifyContent: 'center',
		alignItems: 'center',
	},
	mask: {
		...StyleSheet.absoluteFill,
		overflow: 'hidden',
	},
})
