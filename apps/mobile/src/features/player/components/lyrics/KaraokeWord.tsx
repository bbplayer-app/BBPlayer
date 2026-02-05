import type { LyricSpan } from '@bbplayer/splash'
import { memo } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

interface KaraokeWordProps {
	span: LyricSpan
	currentTime: SharedValue<number>
	baseStyle?: StyleProp<TextStyle>
	activeColor: string
	inactiveColor: string
	isHighlighted: boolean
}

export const KaraokeWord = memo(function KaraokeWord({
	span,
	currentTime,
	baseStyle,
	activeColor,
	inactiveColor,
	isHighlighted,
}: KaraokeWordProps) {
	const width = useSharedValue(0)

	const maskStyle = useAnimatedStyle(() => {
		// 如果不处于高亮行，直接不计算动画
		if (!isHighlighted) {
			return {
				width: 0,
				opacity: withTiming(0, { duration: 300 }),
			}
		}

		const progress = interpolate(
			currentTime.value * 1000, // Convert to ms
			[span.startTime, span.endTime],
			[0, 100],
			Extrapolation.CLAMP,
		)

		return {
			width: `${progress}%`,
			opacity: withTiming(1, { duration: 300 }),
		}
	})

	const activeTextStyle = useAnimatedStyle(() => {
		if (!isHighlighted) return { width: width.value, color: activeColor }
		return {
			width: width.value,
			color: activeColor,
		}
	})

	return (
		<View
			style={styles.container}
			onLayout={(e) => {
				width.set(e.nativeEvent.layout.width)
			}}
		>
			<Text
				style={[baseStyle, { color: inactiveColor }]}
				numberOfLines={1}
			>
				{span.text}
			</Text>

			<Animated.View
				style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, maskStyle]}
			>
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

const AnimatedText = Animated.createAnimatedComponent(Text)

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		justifyContent: 'center',
		alignItems: 'center',
	},
})
