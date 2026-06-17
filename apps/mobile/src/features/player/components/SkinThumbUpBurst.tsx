import { Image } from 'expo-image'
import { memo, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import useSkinStore from '@/hooks/stores/useSkinStore'
import type { AppSkin } from '@/services/theme/types'

interface SkinThumbUpBurstProps {
	skin: AppSkin | null
	playSignal: number
}

const ICON_BUTTON_SLOT_SIZE = 52
const MAX_BURST_SIZE = 104
const ENTRY_DURATION_MS = 180
const EXIT_DURATION_MS = 260
const ENTRY_SCALE = 0.42
const FALLBACK_FPS = 24

const SkinThumbUpBurst = memo(function SkinThumbUpBurst({
	skin,
	playSignal,
}: SkinThumbUpBurstProps) {
	const opacity = useSharedValue(0)
	const scale = useSharedValue(ENTRY_SCALE)
	const frameProgress = useSharedValue(0)
	const [visible, setVisible] = useState(false)

	const thumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const thumbUpSprite = skin?.thumbUpSprites?.[thumbUpIndex]

	const metrics = useMemo(() => {
		if (!thumbUpSprite?.spriteSheetUri) return null

		const frameCount = Math.floor(thumbUpSprite.frameCount)
		const frameWidth = Math.floor(thumbUpSprite.frameWidth)
		const frameHeight = Math.floor(thumbUpSprite.frameHeight)
		if (frameCount <= 0 || frameWidth <= 0 || frameHeight <= 0) return null

		const aspectRatio = frameWidth / frameHeight
		const viewportWidth =
			aspectRatio >= 1 ? MAX_BURST_SIZE : MAX_BURST_SIZE * aspectRatio
		const viewportHeight =
			aspectRatio >= 1 ? MAX_BURST_SIZE / aspectRatio : MAX_BURST_SIZE
		const fps = thumbUpSprite.fps > 0 ? thumbUpSprite.fps : FALLBACK_FPS

		return {
			frameCount,
			playbackDuration: (frameCount / fps) * 1000,
			sheetHeight: viewportHeight * frameCount,
			viewportHeight,
			viewportWidth,
		}
	}, [thumbUpSprite])

	useEffect(() => {
		if (!metrics || !thumbUpSprite || playSignal === 0) {
			setVisible(false)
			return
		}

		const fadeDelay = Math.max(0, metrics.playbackDuration - EXIT_DURATION_MS)

		setVisible(true)
		cancelAnimation(opacity)
		cancelAnimation(scale)
		cancelAnimation(frameProgress)

		opacity.value = 0
		scale.value = ENTRY_SCALE
		frameProgress.value = 0

		opacity.value = withSequence(
			withTiming(1, {
				duration: ENTRY_DURATION_MS,
				easing: Easing.out(Easing.quad),
			}),
			withDelay(
				fadeDelay,
				withTiming(
					0,
					{ duration: EXIT_DURATION_MS, easing: Easing.in(Easing.quad) },
					(finished) => {
						if (finished) scheduleOnRN(setVisible, false)
					},
				),
			),
		)
		scale.value = withTiming(1, {
			duration: ENTRY_DURATION_MS,
			easing: Easing.out(Easing.back(1.35)),
		})
		frameProgress.value = withDelay(
			ENTRY_DURATION_MS,
			withTiming(metrics.frameCount, {
				duration: metrics.playbackDuration,
				easing: Easing.linear,
			}),
		)

		return () => {
			cancelAnimation(opacity)
			cancelAnimation(scale)
			cancelAnimation(frameProgress)
		}
	}, [frameProgress, metrics, opacity, playSignal, scale, thumbUpSprite])

	const containerStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ scale: scale.value }],
	}))

	const spriteStyle = useAnimatedStyle(() => {
		const frameIndex = Math.min(
			Math.max(0, Math.floor(frameProgress.value)),
			(metrics?.frameCount ?? 1) - 1,
		)

		return {
			transform: [
				{
					translateY: -frameIndex * (metrics?.viewportHeight ?? 0),
				},
			],
		}
	})

	if (!visible || !metrics || !thumbUpSprite) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[
				styles.container,
				{
					bottom: ICON_BUTTON_SLOT_SIZE - 10,
					height: metrics.viewportHeight,
					right: (ICON_BUTTON_SLOT_SIZE - metrics.viewportWidth) / 2,
					width: metrics.viewportWidth,
				},
				containerStyle,
			]}
		>
			<View
				style={[
					styles.frame,
					{
						height: metrics.viewportHeight,
						width: metrics.viewportWidth,
					},
				]}
			>
				<Animated.View
					style={[
						{
							height: metrics.sheetHeight,
							width: metrics.viewportWidth,
						},
						spriteStyle,
					]}
				>
					<Image
						source={thumbUpSprite.spriteSheetUri}
						style={{
							height: metrics.sheetHeight,
							width: metrics.viewportWidth,
						}}
						contentFit='fill'
						cachePolicy='memory-disk'
						recyclingKey={thumbUpSprite.spriteSheetUri}
					/>
				</Animated.View>
			</View>
		</Animated.View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		zIndex: 10,
	},
	frame: {
		overflow: 'hidden',
	},
})

export default SkinThumbUpBurst
