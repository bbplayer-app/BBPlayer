import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import Animated, {
	cancelAnimation,
	Easing,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated'

const chips = [0, 1, 2]

export function FollowingGroupsSkeleton({
	animate = true,
}: {
	animate?: boolean
}) {
	const { colors } = useTheme()
	const opacity = useSharedValue(1)
	useEffect(() => {
		if (!animate) {
			cancelAnimation(opacity)
			opacity.set(1)
			return
		}
		opacity.set(0.68)
		opacity.set(
			withRepeat(
				withTiming(1, {
					duration: 900,
					easing: Easing.inOut(Easing.quad),
					reduceMotion: ReduceMotion.System,
				}),
				-1,
				true,
			),
		)
		return () => cancelAnimation(opacity)
	}, [animate, opacity])
	const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
	return (
		<Animated.View
			style={[styles.row, pulseStyle]}
			pointerEvents='none'
			accessible={false}
		>
			{chips.map((chip) => (
				<View
					key={chip}
					style={[styles.chip, { backgroundColor: colors.surfaceVariant }]}
				/>
			))}
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', gap: 8, paddingVertical: 4, overflow: 'hidden' },
	chip: { width: 96, height: 32, borderRadius: 8, flexShrink: 0 },
})
