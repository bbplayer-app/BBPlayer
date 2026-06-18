import { memo, useEffect, useRef, useState } from 'react'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from 'react-native-reanimated'
import { RNSvgaPlayer, SvgaPlayerRef } from 'rn-newarch-svga-player'

import useSkinStore from '@/hooks/stores/useSkinStore'
import type { AppSkin } from '@/services/theme/types'
import log from '@/utils/log'

interface SkinThumbUpBurstProps {
	skin: AppSkin | null
	playSignal: number
}

const DISPLAY_SIZE = 96

const SkinThumbUpBurst = memo(function SkinThumbUpBurst({
	skin,
	playSignal,
}: SkinThumbUpBurstProps) {
	const opacity = useSharedValue(0)
	const containerTranslateY = useSharedValue(0)
	const scale = useSharedValue(0.4)
	const [visible, setVisible] = useState(false)
	const playerRef = useRef<SvgaPlayerRef>(null)

	const thumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const thumbUp = skin?.thumbUps[thumbUpIndex]
	const animation = thumbUp?.animation
	const playbackDuration = thumbUp?.durationMs ?? 2000

	useEffect(() => {
		if (!animation || playSignal === 0) return

		log.debug('[thumbUp] svga animation start', {
			animation,
			durationMs: playbackDuration,
		})

		const visibleDuration = playbackDuration + 520

		setVisible(true)
		opacity.value = 0
		containerTranslateY.value = 0
		scale.value = 0.4

		opacity.value = withSequence(
			withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
			withDelay(
				playbackDuration - 460,
				withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
			),
		)
		containerTranslateY.value = withTiming(-84, {
			duration: visibleDuration,
			easing: Easing.out(Easing.cubic),
		})
		scale.value = withTiming(1, {
			duration: 360,
			easing: Easing.out(Easing.back(1.4)),
		})

		playerRef.current?.startAnimation()

		const hideTimer = setTimeout(() => setVisible(false), visibleDuration)
		return () => {
			clearTimeout(hideTimer)
		}
	}, [
		animation,
		opacity,
		playSignal,
		playbackDuration,
		scale,
		containerTranslateY,
	])

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [
			{ translateY: containerTranslateY.value },
			{ scale: scale.value },
		],
	}))

	if (!visible || !animation) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[
				{
					position: 'absolute',
					right: -32,
					bottom: 8,
					width: DISPLAY_SIZE,
					height: DISPLAY_SIZE,
					zIndex: 10,
				},
				animatedStyle,
			]}
		>
			<RNSvgaPlayer
				ref={playerRef}
				source={animation}
				autoPlay={false}
				loops={1}
				clearsAfterStop={false}
				style={{
					width: DISPLAY_SIZE,
					height: DISPLAY_SIZE,
				}}
			/>
		</Animated.View>
	)
})

export default SkinThumbUpBurst
