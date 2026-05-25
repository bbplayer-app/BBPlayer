import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { hide as hideBootSplash } from 'react-native-bootsplash'
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from 'react-native-reanimated'

import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

const logoSource = require('../../assets/bootsplash/logo.png') as number

interface AnimatedBootSplashProps {
	ready: boolean
}

const AnimatedBootSplash = memo(function AnimatedBootSplash({
	ready,
}: AnimatedBootSplashProps) {
	const { height, width } = useWindowDimensions()
	const activeSkin = useActiveSkin()
	const playFullAnimation = useAppStore(
		(state) => state.settings.playFullSkinBootSplashAnimation,
	)
	const [visible, setVisible] = useState(true)
	const [nativeHidden, setNativeHidden] = useState(false)
	const logoTranslateY = useSharedValue(0)
	const logoScale = useSharedValue(1)
	const mediaOpacity = useSharedValue(0)
	const containerOpacity = useSharedValue(1)

	const player = useVideoPlayer(
		activeSkin?.bootSplash.video.uri ?? null,
		(video) => {
			video.loop = false
			video.muted = true
		},
	)

	useEffect(() => {
		if (!ready || nativeHidden) return
		void hideBootSplash({ fade: false }).then(() => setNativeHidden(true))
	}, [nativeHidden, ready])

	useEffect(() => {
		if (!ready || !nativeHidden) return

		const hideDelay = playFullAnimation ? 6000 : 1200

		logoTranslateY.value = withTiming(height * 0.32, {
			duration: 620,
			easing: Easing.out(Easing.cubic),
		})
		logoScale.value = withTiming(0.48, {
			duration: 620,
			easing: Easing.out(Easing.cubic),
		})
		mediaOpacity.value = withDelay(
			180,
			withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
		)
		containerOpacity.value = withDelay(
			hideDelay,
			withTiming(0, { duration: 280 }, (finished) => {
				if (finished) runOnJS(setVisible)(false)
			}),
		)

		if (activeSkin) {
			player.play()
		}
	}, [
		activeSkin,
		containerOpacity,
		height,
		logoScale,
		logoTranslateY,
		mediaOpacity,
		nativeHidden,
		player,
		playFullAnimation,
		ready,
	])

	const logoStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: logoTranslateY.value },
			{ scale: logoScale.value },
		],
	}))

	const mediaStyle = useAnimatedStyle(() => ({
		opacity: mediaOpacity.value,
	}))

	const containerStyle = useAnimatedStyle(() => ({
		opacity: containerOpacity.value,
	}))

	if (!visible) return null

	return (
		<Animated.View
			pointerEvents='none'
			style={[styles.container, containerStyle]}
		>
			<Animated.View style={[styles.mediaContainer, mediaStyle]}>
				{activeSkin ? (
					<VideoView
						player={player}
						style={[
							styles.video,
							{
								width,
								height,
							},
						]}
						contentFit='cover'
						nativeControls={false}
						surfaceType='textureView'
					/>
				) : null}
				{activeSkin ? (
					<Image
						source={activeSkin.bootSplash.card}
						style={styles.card}
						contentFit='contain'
						cachePolicy='memory-disk'
					/>
				) : null}
			</Animated.View>
			<Animated.Image
				source={logoSource}
				style={[styles.logo, logoStyle]}
				resizeMode='contain'
			/>
		</Animated.View>
	)
})

const styles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFillObject,
		zIndex: 9999,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFFFFF',
	},
	mediaContainer: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
	},
	video: {
		...StyleSheet.absoluteFillObject,
	},
	card: {
		width: '72%',
		aspectRatio: 522 / 696,
	},
	logo: {
		position: 'absolute',
		width: 120,
		height: 120,
	},
})

export default AnimatedBootSplash
