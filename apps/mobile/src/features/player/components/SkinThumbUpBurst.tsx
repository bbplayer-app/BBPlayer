import { Image } from 'expo-image'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'

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
	const opacity = useRef(new Animated.Value(0)).current
	const translateY = useRef(new Animated.Value(0)).current
	const scale = useRef(new Animated.Value(0.4)).current
	const [visible, setVisible] = useState(false)
	const [frame, setFrame] = useState(0)

	const thumbUp = skin?.player.thumbUp
	const frameSources = useMemo(() => {
		if (!thumbUp) return []
		return Array.from({ length: thumbUp.frames.count }, (_, index) => ({
			uri: `${thumbUp.frames.directoryUri}/frame_${String(index).padStart(3, '0')}.png`,
		}))
	}, [thumbUp])

	useEffect(() => {
		if (!thumbUp || playSignal === 0) return

		setVisible(true)
		setFrame(0)
		opacity.setValue(0)
		translateY.setValue(0)
		scale.setValue(0.4)

		const frameDuration = 1000 / thumbUp.frames.fps
		const frameTimer = setInterval(() => {
			setFrame((current) => {
				const next = current + 1
				if (next >= thumbUp.frames.count) {
					clearInterval(frameTimer)
					return current
				}
				return next
			})
		}, frameDuration)

		Animated.parallel([
			Animated.sequence([
				Animated.timing(opacity, {
					toValue: 1,
					duration: 120,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(opacity, {
					toValue: 0,
					duration: 520,
					delay: 1300,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
			]),
			Animated.timing(translateY, {
				toValue: -72,
				duration: 1900,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
			Animated.timing(scale, {
				toValue: 1,
				duration: 360,
				easing: Easing.out(Easing.back(1.4)),
				useNativeDriver: true,
			}),
		]).start(({ finished }) => {
			if (finished) setVisible(false)
		})

		return () => {
			clearInterval(frameTimer)
		}
	}, [opacity, playSignal, scale, thumbUp, translateY])

	if (!visible || !thumbUp) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[
				styles.container,
				{
					opacity,
					transform: [{ translateY }, { scale }],
				},
			]}
		>
			<Image
				source={frameSources[frame] ?? thumbUp.preview}
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
