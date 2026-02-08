import ImageThemeColors from '@bbplayer/image-theme-colors'
import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import {
	Canvas,
	Group,
	LinearGradient,
	Rect,
	vec,
} from '@shopify/react-native-skia'
import { useImage } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import { PlayerFunctionalMenu } from '@/features/player/components/PlayerFunctionalMenu'
import { PlayerHeader } from '@/features/player/components/PlayerHeader'
import Lyrics from '@/features/player/components/PlayerLyrics'
import PlayerMainTab from '@/features/player/components/PlayerMainTab'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import useAppStore from '@/hooks/stores/useAppStore'
import log, { reportErrorToSentry } from '@/utils/log'
import toast from '@/utils/toast'

const logger = log.extend('App.Player')

const OVERLAY_OPACITY = 0.5
const DISMISS_THRESHOLD = 150
const ANIMATION_DURATION = 300

export default function PlayerPage() {
	const theme = useTheme()
	const colors = theme.colors
	const insets = useSafeAreaInsets()
	const sheetRef = useRef<TrueSheet>(null)
	const currentTrack = useCurrentTrack()
	const coverRef = useImage(currentTrack?.coverUrl ?? '', {
		onError: () => void 0,
	})
	const { width, height } = useWindowDimensions()
	const colorScheme = useColorScheme()
	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const setSettings = useAppStore((state) => state.setSettings)
	const [isForeground, setIsForeground] = useState(
		AppState.currentState === 'active',
	)
	const [isPreventingBack, setIsPreventingBack] = useState(true)

	const [activeTab, setActiveTab] = useState<'main' | 'lyrics'>('main')
	const index = activeTab === 'lyrics' ? 1 : 0

	const translateY = useSharedValue(height)
	const isClosing = useSharedValue(false)

	// 进场动画
	useEffect(() => {
		translateY.value = withTiming(0, { duration: ANIMATION_DURATION })
	}, [translateY])

	const dismissPlayer = () => {
		setIsPreventingBack(false)

		setImmediate(() => {
			if (router.canGoBack()) {
				router.back()
			}
		})
	}

	const handleDismiss = () => {
		if (activeTab === 'lyrics') {
			setActiveTab('main')
			return
		}
		if (isClosing.value) return
		isClosing.set(true)
		translateY.set(
			withTiming(height, { duration: ANIMATION_DURATION }, () => {
				scheduleOnRN(dismissPlayer)
			}),
		)
	}

	const panGesture = Gesture.Pan()
		.enabled(activeTab === 'main')
		.activeOffsetY([10, 1000])
		.failOffsetX([-10, 10])
		.onUpdate((event) => {
			'worklet'
			if (isClosing.value) return
			if (event.translationY > 0) {
				translateY.set(event.translationY)
			}
		})
		.onEnd((event) => {
			'worklet'
			if (isClosing.value) return

			if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
				isClosing.value = true
				translateY.set(
					withTiming(height, { duration: ANIMATION_DURATION }, () => {
						scheduleOnRN(dismissPlayer)
					}),
				)
			} else {
				translateY.set(withTiming(0, { duration: 200 }))
			}
		})

	const overlayAnimatedStyle = useAnimatedStyle(() => {
		const opacity = interpolate(
			translateY.value,
			[0, height],
			[OVERLAY_OPACITY, 0],
		)
		return {
			opacity,
		}
	})

	const contentAnimatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ translateY: translateY.value }],
		}
	})

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextAppState) => {
			setIsForeground(nextAppState === 'active')
		})

		return () => {
			subscription.remove()
		}
	}, [])

	const realHeight = useMemo(() => {
		return height + insets.top + insets.bottom
	}, [height, insets.bottom, insets.top])

	const gradientMainColor = useSharedValue(colors.background)
	const scrollX = useSharedValue(0)

	const [menuVisible, setMenuVisible] = useState(false)

	useEffect(() => {
		scrollX.value = withTiming(activeTab === 'lyrics' ? 1 : 0, {
			duration: 300,
		})
	}, [activeTab, scrollX])

	const jumpTo = (key: string) => {
		setActiveTab(key === 'lyrics' ? 'lyrics' : 'main')
	}

	const gradientColors = useDerivedValue(() => {
		if (playerBackgroundStyle !== 'gradient') {
			return [colors.background, colors.background]
		}
		return [gradientMainColor.value, colors.background]
	})

	useEffect(() => {
		if (!coverRef || playerBackgroundStyle === 'md3' || !isForeground) {
			if (playerBackgroundStyle !== 'gradient' && !isForeground) {
				gradientMainColor.set(colors.background)
			}
			return
		}
		ImageThemeColors.extractThemeColorAsync(coverRef)
			.then((palette) => {
				const animationConfig = {
					duration: 400,
					easing: Easing.out(Easing.quad),
				}

				if (playerBackgroundStyle === 'gradient') {
					let topColor: string
					if (colorScheme === 'dark') {
						topColor =
							palette.darkMuted?.hex ?? palette.muted?.hex ?? colors.background
					} else {
						topColor =
							palette.lightMuted?.hex ?? palette.muted?.hex ?? colors.background
					}

					gradientMainColor.set(withTiming(topColor, animationConfig))
				}
			})
			.catch((e) => {
				logger.error('提取封面图片主题色失败', e)
				reportErrorToSentry(e, '提取封面图片主题色失败', 'App.Player')
			})
	}, [
		colorScheme,
		colors.background,
		coverRef,
		gradientMainColor,
		isForeground,
		playerBackgroundStyle,
	])

	const scrimColors = useMemo(() => {
		if (playerBackgroundStyle !== 'gradient')
			return ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']
		if (colorScheme === 'dark') {
			return ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0)']
		} else {
			return ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0)']
		}
	}, [colorScheme, playerBackgroundStyle])

	const [queueVisible, setQueueVisible] = useState(false)

	usePreventRemove(isPreventingBack, () => {
		if (menuVisible) {
			setMenuVisible(false)
			return
		}
		if (queueVisible) {
			const sheet = sheetRef.current
			if (!sheet) {
				setQueueVisible(false)
				return
			}
			sheet
				.dismiss()
				.catch(() => {
					// Ignore error if view not found or already dismissed
				})
				.finally(() => {
					setQueueVisible(false)
				})
			return
		}
		if (activeTab === 'lyrics') {
			setActiveTab('main')
			return
		}
		handleDismiss()
	})

	const scrimEndVec = vec(0, realHeight * 0.5)

	useEffect(() => {
		// @ts-expect-error -- 虽然我们项目内已经移除了 streamer 选项，但部分存量用户可能还在这个选项，需要帮他回退
		if (playerBackgroundStyle === 'streamer') {
			toast.show(
				'因为会对性能造成较大影响，并且也不好看，所以我们移除了流光效果，已为您回退到渐变模式',
			)
			setSettings({ playerBackgroundStyle: 'gradient' })
		}
	}, [playerBackgroundStyle, setSettings])

	const mainTabStyle = useAnimatedStyle(() => {
		const opacity = interpolate(scrollX.value, [0, 0.5, 1], [1, 0, 0])
		return {
			opacity,
			pointerEvents: scrollX.value > 0.5 ? 'none' : 'auto',
		}
	})

	const lyricsTabStyle = useAnimatedStyle(() => {
		const opacity = interpolate(scrollX.value, [0, 0.5, 1], [0, 0, 1])
		return {
			opacity,
			pointerEvents: scrollX.value < 0.5 ? 'none' : 'auto',
		}
	})

	return (
		<View style={styles.fullScreen}>
			{/* Black overlay */}
			<Animated.View
				style={[styles.overlay, overlayAnimatedStyle]}
				pointerEvents='none'
			/>

			{/* Player content */}
			<GestureDetector gesture={panGesture}>
				<Animated.View style={[styles.fullScreen, contentAnimatedStyle]}>
					<Canvas style={StyleSheet.absoluteFill}>
						<Rect
							x={0}
							y={0}
							width={width}
							height={realHeight}
							color={colors.background}
						/>
						{playerBackgroundStyle === 'gradient' && (
							<Group>
								<Rect
									x={0}
									y={0}
									width={width}
									height={realHeight}
								>
									<LinearGradient
										start={vec(0, 0)}
										end={vec(0, realHeight)}
										colors={gradientColors}
										positions={[0, 1]}
									/>
								</Rect>
								<Rect
									x={0}
									y={0}
									width={width}
									height={realHeight}
								>
									<LinearGradient
										start={vec(0, 0)}
										end={scrimEndVec}
										colors={scrimColors}
									/>
								</Rect>
							</Group>
						)}
					</Canvas>

					<View
						style={[
							styles.container,
							{
								paddingTop: insets.top,
							},
						]}
					>
						<View
							style={[
								styles.innerContainer,
								{ pointerEvents: menuVisible ? 'none' : 'auto' },
							]}
						>
							<PlayerHeader
								onMorePress={() => setMenuVisible(true)}
								onBack={handleDismiss}
								index={index}
								scrollX={scrollX}
							/>
							<View style={styles.tabView}>
								<Animated.View style={[StyleSheet.absoluteFill, mainTabStyle]}>
									<PlayerMainTab
										sheetRef={sheetRef}
										jumpTo={jumpTo}
										imageRef={coverRef}
										onPresent={() => setQueueVisible(true)}
										danmakuEnabled={activeTab === 'main'}
									/>
								</Animated.View>
								<Animated.View
									style={[StyleSheet.absoluteFill, lyricsTabStyle]}
								>
									<Lyrics
										currentIndex={index}
										onPressBackground={() => jumpTo('main')}
									/>
								</Animated.View>
							</View>
						</View>

						<PlayerFunctionalMenu
							menuVisible={menuVisible}
							setMenuVisible={setMenuVisible}
						/>

						<PlayerQueueModal
							sheetRef={sheetRef}
							isVisible={queueVisible}
							onDidDismiss={() => setQueueVisible(false)}
							onDidPresent={() => setQueueVisible(true)}
						/>
					</View>
				</Animated.View>
			</GestureDetector>
		</View>
	)
}

const styles = StyleSheet.create({
	fullScreen: {
		flex: 1,
	},
	overlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: 'black',
	},
	container: {
		flex: 1,
	},
	innerContainer: {
		flex: 1,
	},
	tabView: {
		flex: 1,
	},
})
