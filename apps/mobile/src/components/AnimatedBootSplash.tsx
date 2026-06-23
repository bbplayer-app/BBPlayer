import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useEffect, useState } from 'react'
import { AppState, StyleSheet, useWindowDimensions } from 'react-native'
import { useHideAnimation, type Manifest } from 'react-native-bootsplash'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { storage } from '@/utils/mmkv'

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
	const selectedAssetId = useSkinStore(
		(state) => state.selectedSkinBootSplashAssetId,
	)
	const selectedMode = useSkinStore((state) => state.selectedSkinBootSplashMode)
	const playFullAnimation = useSkinStore(
		(state) => state.playFullSkinBootSplashAnimation,
	)
	const bootSplashAsset =
		activeSkin?.bootSplash.items?.find((item) => item.id === selectedAssetId) ??
		activeSkin?.bootSplash.items?.[0] ??
		null

	// 同步 MMKV 预加载 — 绕过 useActiveSkin 的异步 I/O，
	// 确保 useHideAnimation 的 animate 回调中 bootSplashVideo 不为 null
	const preloadRaw = storage.getString('boot_splash_preload')
	let preloadedVideo: string | null = null
	let preloadedCard: string | null = null
	if (preloadRaw) {
		const pipeIdx = preloadRaw.indexOf('|')
		preloadedVideo = preloadRaw.slice(0, pipeIdx) || null
		preloadedCard = preloadRaw.slice(pipeIdx + 1) || null
	}

	const bootSplashVideo =
		preloadedVideo && selectedMode === 'video'
			? preloadedVideo
			: selectedMode === 'video'
				? (bootSplashAsset?.video ?? null)
				: null
	const bootSplashAssetCard = preloadedCard || bootSplashAsset?.card || null
	const [visible, setVisible] = useState(true)
	const [introFinished, setIntroFinished] = useState(false)
	const [videoEnded, setVideoEnded] = useState(false)
	const logoTranslateY = useSharedValue(0)
	const logoScale = useSharedValue(1)
	const mediaOpacity = useSharedValue(0)
	const containerOpacity = useSharedValue(1)

	const player = useVideoPlayer(bootSplashVideo ?? null, (video) => {
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

	// 后台切回前台时 TextureView 可能被销毁，视频停在当前位置，
	// playToEnd 不会再触发 → 卡死。重播一次让视频走完。
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextState) => {
			if (
				nextState === 'active' &&
				playFullAnimation &&
				bootSplashVideo &&
				!videoEnded
			) {
				player.play()
			}
		})
		return () => subscription.remove()
	}, [playFullAnimation, bootSplashVideo, videoEnded, player])

	// 安全兜底：即使视频卡住，最多等 3s 也强制淡出
	useEffect(() => {
		if (!introFinished || !bootSplashVideo) return
		const timer = setTimeout(() => setVideoEnded(true), 3000)
		return () => clearTimeout(timer)
	}, [introFinished, bootSplashVideo])

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
				{bootSplashAssetCard ? (
					<Image
						source={bootSplashAssetCard}
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
