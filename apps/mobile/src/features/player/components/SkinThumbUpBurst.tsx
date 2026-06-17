import { Image } from 'expo-image'
import { memo, useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from 'react-native-reanimated'

import useSkinStore from '@/hooks/stores/useSkinStore'
import type { AppSkin } from '@/services/theme/types'

interface SkinThumbUpBurstProps {
	skin: AppSkin | null
	playSignal: number
}

const ANIMATION_SIZE = 96

const SkinThumbUpBurst = memo(function SkinThumbUpBurst({
	skin,
	playSignal,
}: SkinThumbUpBurstProps) {
	const opacity = useSharedValue(0)
	const translateY = useSharedValue(0)
	const scale = useSharedValue(0.4)
	const [visible, setVisible] = useState(false)

	const thumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const thumbUp = skin?.thumbUps[thumbUpIndex]
	const animation = thumbUp?.animation
	const playbackDuration = thumbUp?.durationMs ?? 1400

	useEffect(() => {
		if (!animation || playSignal === 0) return

		const fadeDelay = Math.max(0, playbackDuration - 460)
		const visibleDuration = playbackDuration + 520

		setVisible(true)
		opacity.value = 0
		translateY.value = 0
		scale.value = 0.4

		opacity.value = withSequence(
			withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
			withDelay(
				fadeDelay,
				withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
			),
		)
		translateY.value = withTiming(-84, {
			duration: visibleDuration,
			easing: Easing.out(Easing.cubic),
		})
		scale.value = withTiming(1, {
			duration: 360,
			easing: Easing.out(Easing.back(1.4)),
		})

		const hideTimer = setTimeout(() => setVisible(false), visibleDuration)
		return () => {
			clearTimeout(hideTimer)
		}
	}, [animation, opacity, playSignal, playbackDuration, scale, translateY])

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }, { scale: scale.value }],
	}))

	if (!visible || !animation) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[styles.container, animatedStyle]}
		>
			<Image
				key={`${animation}:${playSignal}`}
				source={animation}
				style={styles.image}
				contentFit='contain'
				cachePolicy='memory-disk'
				recyclingKey={`${animation}:${playSignal}`}
			/>
		</Animated.View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		right: -32,
		bottom: 8,
		width: ANIMATION_SIZE,
		height: ANIMATION_SIZE,
		zIndex: 10,
	},
	image: {
		width: ANIMATION_SIZE,
		height: ANIMATION_SIZE,
	},
})

export default SkinThumbUpBurst
