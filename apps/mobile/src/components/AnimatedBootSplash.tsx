import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { hide as hideBootSplash } from 'react-native-bootsplash'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

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
	const selectedAssetId = useAppStore(
		(state) => state.settings.selectedSkinBootSplashAssetId,
	)
	const bootSplashAsset =
		activeSkin?.bootSplash.items.find((item) => item.id === selectedAssetId) ??
		activeSkin?.bootSplash.items[0] ??
		null
	const [visible, setVisible] = useState(true)
	const [nativeHidden, setNativeHidden] = useState(false)
	const logoTranslateY = useSharedValue(0)
	const logoScale = useSharedValue(1)
	const mediaOpacity = useSharedValue(0)
	const containerOpacity = useSharedValue(1)

	const player = useVideoPlayer(
		bootSplashAsset?.video?.uri ?? null,
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

		const hideDelay = playFullAnimation ? 6000 : 300

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
				if (finished) scheduleOnRN(setVisible, false)
			}),
		)

		if (bootSplashAsset?.video) {
			player.play()
		}
	}, [
		activeSkin,
		bootSplashAsset,
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
				{bootSplashAsset ? (
					<Image
						source={bootSplashAsset.card}
						style={styles.card}
						contentFit='contain'
						cachePolicy='memory-disk'
					/>
				) : null}
				{bootSplashAsset?.video ? (
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
		...StyleSheet.absoluteFill,
		zIndex: 9999,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFFFFF',
	},
	mediaContainer: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		justifyContent: 'center',
	},
	video: {
		...StyleSheet.absoluteFill,
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
