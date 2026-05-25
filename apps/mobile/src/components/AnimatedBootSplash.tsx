import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { hide as hideBootSplash } from 'react-native-bootsplash'
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
	const bootSplashAsset =
		activeSkin?.bootSplash.items.find((item) => item.id === selectedAssetId) ??
		activeSkin?.bootSplash.items[0] ??
		null
	const [visible, setVisible] = useState(true)
	const [introFinished, setIntroFinished] = useState(false)
	const startedRef = useRef(false)
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
		if (startedRef.current) return

		startedRef.current = true
		void hideBootSplash({ fade: false })
		logoTranslateY.value = withTiming(height / 2 - insets.bottom - 42, {
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

		if (bootSplashAsset?.video) {
			player.play()
		}
	}, [
		bootSplashAsset,
		height,
		insets.bottom,
		logoScale,
		logoTranslateY,
		mediaOpacity,
		player,
	])

	useEffect(() => {
		if (!ready || !introFinished) return

		containerOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
			if (finished) scheduleOnRN(setVisible, false)
		})
	}, [containerOpacity, introFinished, ready])

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
