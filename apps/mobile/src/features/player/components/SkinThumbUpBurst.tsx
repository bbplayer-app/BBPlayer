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

import type { AppSkin } from '@/lib/theme/skins'

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

	const thumbUp = skin?.player.thumbUp

	useEffect(() => {
		if (!thumbUp || playSignal === 0) return

		setVisible(true)
		opacity.value = 0
		translateY.value = 0
		scale.value = 0.4

		opacity.value = withSequence(
			withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
			withDelay(
				1300,
				withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) }),
			),
		)
		translateY.value = withTiming(-72, {
			duration: 1900,
			easing: Easing.out(Easing.cubic),
		})
		scale.value = withTiming(1, {
			duration: 360,
			easing: Easing.out(Easing.back(1.4)),
		})

		const timer = setTimeout(() => setVisible(false), 2000)
		return () => clearTimeout(timer)
	}, [opacity, playSignal, scale, thumbUp, translateY])

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }, { scale: scale.value }],
	}))

	if (!visible || !thumbUp) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[styles.container, animatedStyle]}
		>
			<Image
				source={thumbUp.gif}
				style={styles.image}
				contentFit='contain'
				cachePolicy='memory-disk'
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
		width: '100%',
		height: '100%',
	},
})

export default SkinThumbUpBurst
