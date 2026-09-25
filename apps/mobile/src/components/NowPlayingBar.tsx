import {
	Orpheus,
	PlaybackState,
	useAdjacentTracks,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import { useValue } from '@legendapp/state/react'
import { Image } from 'expo-image'
import { useRouter, useSegments } from 'expo-router'
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { EaseView } from 'react-native-ease'
import {
	Directions,
	useTapGesture,
	usePanGesture,
	useFlingGesture,
	useCompetingGestures,
	GestureDetector,
	Touchable,
} from 'react-native-gesture-handler'
import { Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import {
	HIDDEN_SEGMENT_ROOTS,
	nowPlayingBarStore$,
} from '@/hooks/stores/nowPlayingBarStore'
import useAppStore from '@/hooks/stores/useAppStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'
import { resolveTrackCover } from '@/utils/imageUrl'

import ActivityIndicator from './common/ActivityIndicator'

const ProgressBar = memo(function ProgressBar() {
	const { position: sharedProgress, duration: sharedDuration } =
		useSmoothProgress(false)
	const sharedTrackViewWidth = useSharedValue(0)
	const trackViewRef = useRef<View>(null)
	const { colors } = useTheme()

	const animatedStyle = useAnimatedStyle(() => {
		const progressRatio = Math.min(
			sharedProgress.value / Math.max(sharedDuration.value, 1),
			1,
		)
		// 靠 transform 实现滑动效果，避免掉 reflow
		return {
			transform: [
				{
					translateX: (progressRatio - 1) * sharedTrackViewWidth.value,
				},
			],
		}
	})

	useLayoutEffect(() => {
		trackViewRef.current?.measure((_x, _y, width) => {
			sharedTrackViewWidth.set(width)
		})
	}, [sharedTrackViewWidth, trackViewRef])

	return (
		<View style={styles.progressBarContainer}>
			<View
				ref={trackViewRef}
				style={[
					styles.progressBarTrack,
					// { backgroundColor: colors.outlineVariant },
				]}
			>
				<Animated.View
					style={[
						animatedStyle,
						styles.progressBarIndicator,
						{ backgroundColor: colors.primary },
					]}
				/>
			</View>
		</View>
	)
})

const playPause = async () => {
	void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
	const isPlaying = await Orpheus.getIsPlaying()
	if (isPlaying) {
		void Orpheus.pause()
	} else {
		await Orpheus.play()
	}
}

function NowPlayingBar() {
	const segments = useSegments()
	// hiddenScreenActive 在离开隐藏页面后会保持到返回动画结束，避免转场过程中
	// 提前显示；segments 判断则保证进入隐藏页面时立即隐藏。
	const hiddenScreenActive = useValue(nowPlayingBarStore$.hiddenScreenActive)
	const shouldShow =
		!hiddenScreenActive && !HIDDEN_SEGMENT_ROOTS.has(segments[0] ?? '')
	if (!shouldShow) {
		return null
	}

	return <NowPlayingBarContent />
}

const NowPlayingBarContent = memo(function NowPlayingBarContent() {
	const { colors } = useTheme()
	const isPlaying = useIsPlaying()
	const state = usePlaybackState()
	const currentTrack = useCurrentTrack()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const isVisible = currentTrack !== null
	const segments = useSegments()
	const backgroundColor = useValue(nowPlayingBarStore$.backgroundColor)
	const tabBarHeight = useValue(nowPlayingBarStore$.bottomTabBarHeight)
	const retainedBottomTabBarHeight = useValue(
		nowPlayingBarStore$.retainedBottomTabBarHeight,
	)
	const bottomBarHeight =
		segments[0] === '(tabs)'
			? tabBarHeight
			: segments[0] === 'modal'
				? retainedBottomTabBarHeight
				: 0

	const nowPlayingBarStyle = useAppStore((s) => s.settings.nowPlayingBarStyle)

	const finalPlayingIndicator = isPlaying ? 'pause' : 'play'

	const {
		adjacent: { previous: prevTrack, next: nextTrack },
		refresh: refreshAdjacent,
	} = useAdjacentTracks()

	useEffect(() => {
		refreshAdjacent()
	}, [refreshAdjacent])

	const hasPrevSv = useSharedValue(false)
	const hasNextSv = useSharedValue(false)

	useEffect(() => {
		hasPrevSv.set(prevTrack != null)
		hasNextSv.set(nextTrack != null)
	}, [hasPrevSv, hasNextSv, prevTrack, nextTrack])

	const dragOffset = useSharedValue(0)
	const hapticFired = useSharedValue(0)

	const normalOpacity = useAnimatedStyle(() => ({
		opacity: 1 - Math.min(Math.abs(dragOffset.value) / 40, 1),
	}))

	const prevIndicatorOpacity = useAnimatedStyle(() => ({
		opacity: Math.min(Math.max(dragOffset.value / 40, 0), 1),
	}))

	const nextIndicatorOpacity = useAnimatedStyle(() => ({
		opacity: Math.min(Math.max(-dragOffset.value / 40, 0), 1),
	}))

	const navigateOnPlayerUpFling = useFlingGesture({
		direction: Directions.UP,
		onActivate: () => {
			scheduleOnRN(router.navigate, '/player')
		},
	})

	const SWIPE_THRESHOLD = 80

	const panGesture = usePanGesture({
		activeOffsetX: [-10, 10],
		failOffsetY: [-20, 20],
		onUpdate: (e) => {
			'worklet'
			if (
				(e.translationX > 0 && !hasPrevSv.value) ||
				(e.translationX < 0 && !hasNextSv.value)
			) {
				return
			}
			dragOffset.set(e.translationX)
			if (
				e.translationX > SWIPE_THRESHOLD &&
				hapticFired.value !== 1 &&
				hasPrevSv.value
			) {
				hapticFired.set(1)
				scheduleOnRN(
					Haptics.performHaptics,
					Haptics.AndroidHaptics.Context_Click,
				)
			} else if (
				e.translationX < -SWIPE_THRESHOLD &&
				hapticFired.value !== -1 &&
				hasNextSv.value
			) {
				hapticFired.set(-1)
				scheduleOnRN(
					Haptics.performHaptics,
					Haptics.AndroidHaptics.Context_Click,
				)
			}
		},
		onDeactivate: () => {
			'worklet'
			if (dragOffset.value > SWIPE_THRESHOLD && hasPrevSv.value) {
				scheduleOnRN(() => void Orpheus.skipToPrevious())
			} else if (dragOffset.value < -SWIPE_THRESHOLD && hasNextSv.value) {
				scheduleOnRN(() => void Orpheus.skipToNext())
			}
			dragOffset.set(withTiming(0))
			hapticFired.set(0)
		},
	})

	const outerTap = useTapGesture({
		onDeactivate: (e) => {
			if (!e.canceled) {
				scheduleOnRN(router.navigate, '/player')
			}
		},
	})

	const combinedGesture = useCompetingGestures(
		navigateOnPlayerUpFling,
		panGesture,
		outerTap,
	)

	const playerStyle =
		nowPlayingBarStyle === 'bottom'
			? [styles.nowPlayingBarBottom]
			: [styles.nowPlayingBarFloat]

	// 根级覆盖层使用原生 Tab 栏的完整高度，安全区只补一次。
	const isDocked = nowPlayingBarStyle === 'bottom' && Platform.OS !== 'ios'
	const bottomMargin = isDocked
		? bottomBarHeight
		: Math.max(bottomBarHeight, insets.bottom) + 10
	const bottomPadding = isDocked && bottomBarHeight === 0 ? insets.bottom : 0

	const reduceMotion = useReducedMotion()
	// 沉浸模式下播放条瞬时显示/隐藏，不做任何过渡。
	const disableTransition = reduceMotion

	return (
		<EaseView
			initialAnimate={{ translateY: -bottomMargin }}
			animate={{ translateY: -bottomMargin }}
			transition={
				disableTransition
					? { type: 'none' }
					: { type: 'timing', duration: 240, easing: 'easeOut' }
			}
			pointerEvents='box-none'
			style={styles.nowPlayingBarContainer}
		>
			{isVisible && (
				<GestureDetector gesture={combinedGesture}>
					<View
						style={[
							playerStyle,
							{
								backgroundColor: backgroundColor ?? colors.elevation.level2,
								paddingBottom: bottomPadding,
								height:
									nowPlayingBarStyle === 'bottom'
										? 70 + bottomPadding
										: undefined,
							},
						]}
						testID='now-playing-bar'
					>
						<View style={styles.nowPlayingBarContent}>
							<Image
								source={{
									uri:
										resolveTrackCover(
											currentTrack.uniqueKey,
											currentTrack.coverUrl,
										) ?? undefined,
								}}
								style={[
									styles.nowPlayingBarImage,
									{
										borderColor: colors.primary,
										borderRadius: nowPlayingBarStyle === 'bottom' ? 12 : 24,
									},
								]}
								recyclingKey={currentTrack.uniqueKey}
								cachePolicy={'disk'}
							/>

							<View
								style={[
									styles.nowPlayingBarTextContainer,
									{ position: 'relative' },
								]}
							>
								{/* Normal state: displayed inline so the parent has height */}
								<Animated.View
									style={[normalOpacity, { flex: 1, justifyContent: 'center' }]}
									pointerEvents='none'
								>
									<Text
										variant='titleSmall'
										numberOfLines={1}
										style={{ color: colors.onSurface }}
									>
										{currentTrack.title ?? '未知曲目'}
									</Text>
									<Text
										variant='bodySmall'
										numberOfLines={1}
										style={{ color: colors.onSurfaceVariant }}
									>
										{currentTrack.artist?.name ?? '未知'}
									</Text>
								</Animated.View>

								{/* Prev/next indicators: absolutely positioned on top */}
								<Animated.View
									style={[
										prevIndicatorOpacity,
										StyleSheet.absoluteFill,
										{ justifyContent: 'center' },
									]}
									pointerEvents='none'
								>
									<Text
										variant='titleSmall'
										numberOfLines={1}
										style={{ color: colors.onSurface, fontWeight: 'bold' }}
									>
										上一首
									</Text>
									<Text
										variant='bodySmall'
										numberOfLines={1}
										style={{ color: colors.onSurfaceVariant }}
									>
										{prevTrack?.title ?? ''}
									</Text>
								</Animated.View>

								<Animated.View
									style={[
										nextIndicatorOpacity,
										StyleSheet.absoluteFill,
										{ justifyContent: 'center' },
									]}
									pointerEvents='none'
								>
									<Text
										variant='titleSmall'
										numberOfLines={1}
										style={{ color: colors.onSurface, fontWeight: 'bold' }}
									>
										下一首
									</Text>
									<Text
										variant='bodySmall'
										numberOfLines={1}
										style={{ color: colors.onSurfaceVariant }}
									>
										{nextTrack?.title ?? ''}
									</Text>
								</Animated.View>
							</View>

							<View style={styles.nowPlayingBarControls}>
								<Touchable
									style={styles.nowPlayingBarControlButton}
									onPress={() => playPause()}
								>
									{state === PlaybackState.BUFFERING ? (
										<ActivityIndicator size='small' />
									) : (
										<Icon
											source={finalPlayingIndicator}
											size={24}
											color={colors.onSurface}
										/>
									)}
								</Touchable>

								<Touchable
									style={styles.nowPlayingBarControlButton}
									onPress={() => usePlayerQueueSheetStore.getState().open()}
								>
									<Icon
										source='format-list-bulleted'
										size={20}
										color={colors.onSurface}
									/>
								</Touchable>
							</View>
						</View>
						<View
							style={[
								styles.nowPlayingBarProgressContainer,
								nowPlayingBarStyle === 'bottom'
									? { left: 0, right: 0, bottom: bottomPadding }
									: { width: '88%', left: 26, right: 0 },
							]}
						>
							<ProgressBar />
						</View>
					</View>
				</GestureDetector>
			)}
		</EaseView>
	)
})

const styles = StyleSheet.create({
	progressBarContainer: {
		width: '100%',
	},
	progressBarTrack: {
		height: 2,
		overflow: 'hidden',
		position: 'relative',
	},
	progressBarIndicator: {
		height: 2,
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		right: 0,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
	},
	nowPlayingBarBottom: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		position: 'relative',
		height: 70,
	},
	nowPlayingBarFloat: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 24,
		marginHorizontal: 20,
		position: 'relative',
		height: 48,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 3,
		},
		shadowOpacity: 0.29,
		shadowRadius: 4.65,
		elevation: 7,
	},
	nowPlayingBarContent: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	nowPlayingBarImage: {
		height: 48,
		width: 48,
		borderWidth: 1,
		zIndex: 2,
	},
	nowPlayingBarTextContainer: {
		marginLeft: 12,
		flex: 1,
		justifyContent: 'center',
		marginRight: 8,
	},
	nowPlayingBarControls: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 4,
	},
	nowPlayingBarControlButton: {
		borderRadius: 99999,
		padding: 10,
	},
	nowPlayingBarProgressContainer: {
		alignSelf: 'center',
		position: 'absolute',
		bottom: 0,
		zIndex: 1,
	},
})

NowPlayingBar.displayName = 'NowPlayingBar'

export default NowPlayingBar
