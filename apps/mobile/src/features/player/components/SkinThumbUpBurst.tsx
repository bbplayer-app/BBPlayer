import { Image } from 'expo-image'
import { memo, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
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
	const frame = useSharedValue(0)
	const [visible, setVisible] = useState(false)

	const thumbUp = skin?.player.thumbUp
	const frames = thumbUp?.frames
	const playbackDuration = useMemo(() => {
		if (!frames) return 0

		return Math.round((frames.count / Math.max(1, frames.fps)) * 1000)
	}, [frames])

	const frameSources = useMemo(() => {
		if (!frames) return []

		return Array.from({ length: frames.count }, (_, index) => ({
			uri: `${frames.directoryUri}/frame_${String(index).padStart(3, '0')}.png`,
		}))
	}, [frames])

	useEffect(() => {
		if (!frames || playSignal === 0) return

		const fadeDelay = Math.max(0, playbackDuration - 460)
		const visibleDuration = playbackDuration + 520

		setVisible(true)
		opacity.value = 0
		translateY.value = 0
		scale.value = 0.4
		frame.value = 0

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
		frame.value = withTiming(frames.count - 1, {
			duration: playbackDuration,
			easing: Easing.linear,
		})

		const hideTimer = setTimeout(() => setVisible(false), visibleDuration)
		return () => {
			clearTimeout(hideTimer)
		}
	}, [frame, frames, opacity, playSignal, playbackDuration, scale, translateY])

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }, { scale: scale.value }],
	}))

	const stripStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateY: -Math.floor(frame.value) * ANIMATION_SIZE,
			},
		],
	}))

	if (!visible || !thumbUp || frameSources.length === 0) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[styles.container, animatedStyle]}
		>
			<View style={styles.viewport}>
				<Animated.View style={stripStyle}>
					{frameSources.map((source, index) => (
						<Image
							key={`${source.uri}:${playSignal}`}
							source={source}
							style={styles.image}
							contentFit='contain'
							cachePolicy='memory-disk'
							recyclingKey={`${source.uri}:${playSignal}:${index}`}
						/>
					))}
				</Animated.View>
			</View>
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
	viewport: {
		width: ANIMATION_SIZE,
		height: ANIMATION_SIZE,
		overflow: 'hidden',
	},
	image: {
		width: ANIMATION_SIZE,
		height: ANIMATION_SIZE,
	},
})

export default SkinThumbUpBurst
