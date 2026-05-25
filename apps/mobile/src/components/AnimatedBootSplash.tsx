import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { useHideAnimation, type Manifest } from 'react-native-bootsplash'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

const bootSplashManifest =
	require('../../assets/bootsplash/manifest.json') as Manifest

const logoSource = require('../../assets/bootsplash/logo.png') as number

interface AnimatedBootSplashProps {
	ready: boolean
}

const AnimatedBootSplash = memo(function AnimatedBootSplash({
	ready,
}: AnimatedBootSplashProps) {
	const { height, width } = useWindowDimensions()
	const insets = useSafeAreaInsets()
	const activeSkin = useActiveSkin()
	const selectedAssetId = useAppStore(
		(state) => state.settings.selectedSkinBootSplashAssetId,
	)
	const selectedMode = useAppStore(
		(state) => state.settings.selectedSkinBootSplashMode,
	)
	const playFullAnimation = useAppStore(
		(state) => state.settings.playFullSkinBootSplashAnimation,
	)
	const bootSplashAsset =
		activeSkin?.bootSplash.items.find((item) => item.id === selectedAssetId) ??
		activeSkin?.bootSplash.items[0] ??
		null
	const bootSplashVideo =
		selectedMode === 'video' ? (bootSplashAsset?.video ?? null) : null
	const [visible, setVisible] = useState(true)
	const [introFinished, setIntroFinished] = useState(false)
	const [videoEnded, setVideoEnded] = useState(false)
	const logoTranslateY = useSharedValue(0)
	const logoScale = useSharedValue(1)
	const mediaOpacity = useSharedValue(0)
	const containerOpacity = useSharedValue(1)

	const player = useVideoPlayer(bootSplashVideo?.uri ?? null, (video) => {
		video.loop = false
		video.muted = true
	})

	useEffect(() => {
		setVideoEnded(!bootSplashVideo)
	}, [bootSplashVideo])

	useEffect(() => {
		if (!bootSplashVideo) return

		const subscription = player.addListener('playToEnd', () => {
			setVideoEnded(true)
		})
		return () => subscription.remove()
	}, [bootSplashVideo, player])

	const { container, logo } = useHideAnimation({
		manifest: bootSplashManifest,
		logo: logoSource,
		ready: true,
		animate: () => {
			logoTranslateY.value = withTiming(height / 2 - insets.bottom - 41, {
				duration: 620,
				easing: Easing.out(Easing.cubic),
			})
			logoScale.value = withTiming(
				0.48,
				{
					duration: 620,
					easing: Easing.out(Easing.cubic),
				},
				(finished) => {
					if (finished) scheduleOnRN(setIntroFinished, true)
				},
			)
			mediaOpacity.value = withTiming(1, {
				duration: 420,
				easing: Easing.out(Easing.quad),
			})

			if (bootSplashVideo) {
				player.replay()
			}
		},
	})

	useEffect(() => {
		if (!ready || !introFinished) return
		if (playFullAnimation && bootSplashVideo && !videoEnded) return

		containerOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
			if (finished) scheduleOnRN(setVisible, false)
		})
	}, [
		bootSplashVideo,
		containerOpacity,
		introFinished,
		playFullAnimation,
		ready,
		videoEnded,
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
			{...container}
			style={[container.style, styles.container, containerStyle]}
		>
			<Animated.View style={[styles.mediaContainer, mediaStyle]}>
				{bootSplashAsset ? (
					<Image
						source={bootSplashAsset.card}
						style={styles.video}
						contentFit='cover'
						cachePolicy='memory-disk'
					/>
				) : null}
				{bootSplashVideo ? (
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
				{...logo}
				style={[logo.style, styles.logo, logoStyle]}
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
