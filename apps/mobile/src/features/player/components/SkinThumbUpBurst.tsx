import { Image } from 'expo-image'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
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
	const imageRef = useRef<Image>(null)

	const thumbUp = skin?.player.thumbUp
	const playbackDuration = useMemo(() => {
		if (!thumbUp) return 0

		return Math.round(
			(thumbUp.frames.count / Math.max(1, thumbUp.frames.fps)) * 1000,
		)
	}, [thumbUp])

	useEffect(() => {
		if (!thumbUp || playSignal === 0) return

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

		const stopTimer = setTimeout(() => {
			void imageRef.current?.stopAnimating()
		}, playbackDuration)
		const hideTimer = setTimeout(() => setVisible(false), visibleDuration)
		return () => {
			clearTimeout(stopTimer)
			clearTimeout(hideTimer)
		}
	}, [opacity, playSignal, playbackDuration, scale, thumbUp, translateY])

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
				ref={imageRef}
				source={thumbUp.gif}
				style={styles.image}
				contentFit='contain'
				cachePolicy='memory-disk'
				autoplay={false}
				recyclingKey={`${thumbUp.gif.uri}:${playSignal}`}
				onLoadEnd={() => {
					void imageRef.current?.startAnimating()
				}}
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
