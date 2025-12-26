import useAnimatedTrackProgress from '@/hooks/player/useAnimatedTrackProgress'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import * as Haptics from '@/utils/haptics'
import {
	Orpheus,
	PlaybackState,
	useIsPlaying,
	usePlaybackState,
} from '@roitium/expo-orpheus'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useLayoutEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Gesture,
	GestureDetector,
	RectButton,
} from 'react-native-gesture-handler'
import { Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

const ProgressBar = memo(function ProgressBar() {
	const { position: sharedProgress, duration: sharedDuration } =
		useAnimatedTrackProgress(false)
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
			sharedTrackViewWidth.value = width
		})
	}, [sharedTrackViewWidth, trackViewRef])

	return (
		<View style={styles.progressBarContainer}>
			<View
				ref={trackViewRef}
				style={[
					styles.progressBarTrack,
					{ backgroundColor: colors.outlineVariant },
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

const NowPlayingBar = memo(function NowPlayingBar() {
	const { colors } = useTheme()
	const isPlaying = useIsPlaying()
	const state = usePlaybackState()
	const currentTrack = useCurrentTrack()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const opacity = useSharedValue(1)
	const isVisible = currentTrack !== null

	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
	)

	const finalPlayingIndicator =
		state === PlaybackState.BUFFERING ? 'loading' : isPlaying ? 'pause' : 'play'

	const prevTap = Gesture.Tap().onEnd((_e, success) => {
		if (success) {
			scheduleOnRN(
				Haptics.performAndroidHapticsAsync,
				Haptics.AndroidHaptics.Context_Click,
			)
			scheduleOnRN(() => Orpheus.skipToPrevious())
		}
	})
	const playTap = Gesture.Tap().onEnd((_e, success) => {
		if (success) {
			scheduleOnRN(
				Haptics.performAndroidHapticsAsync,
				Haptics.AndroidHaptics.Context_Click,
			)
			scheduleOnRN((_isPlaying) => {
				if (_isPlaying) {
					void Orpheus.pause()
				} else {
					void Orpheus.play()
				}
			}, isPlaying)
		}
	})
	const nextTap = Gesture.Tap().onEnd((_e, success) => {
		if (success) {
			scheduleOnRN(
				Haptics.performAndroidHapticsAsync,
				Haptics.AndroidHaptics.Context_Click,
			)
			scheduleOnRN(() => Orpheus.skipToNext())
		}
	})
	const outerTap = Gesture.Tap()
		.requireExternalGestureToFail(prevTap, playTap, nextTap)
		.onBegin(() => {
			opacity.value = withTiming(0.7, { duration: 100 })
		})
		.onFinalize((_e, success) => {
			opacity.value = withTiming(1, { duration: 100 })

			if (success) {
				scheduleOnRN(router.push, '/player')
			}
		})

	const playerStyle =
		nowPlayingBarStyle === 'bottom'
			? [styles.nowPlayingBarBottom]
			: [styles.nowPlayingBarFloat]

	const animatedStyle = useAnimatedStyle(() => {
		return {
			opacity: opacity.get(),
		}
	})

	return (
		<View
			pointerEvents='box-none'
			style={styles.nowPlayingBarContainer}
		>
			{isVisible && (
				<GestureDetector gesture={outerTap}>
					<Animated.View
						style={[
							playerStyle,
							{
								backgroundColor: colors.elevation.level2,
								marginBottom:
									nowPlayingBarStyle === 'bottom' ? 0 : insets.bottom + 10,
							},
							animatedStyle,
						]}
					>
						<View style={styles.nowPlayingBarContent}>
							<Image
								source={{ uri: currentTrack.coverUrl ?? undefined }}
								style={[
									styles.nowPlayingBarImage,
									{
										borderColor: colors.primary,
										borderRadius: nowPlayingBarStyle === 'bottom' ? 12 : 24,
									},
								]}
								recyclingKey={currentTrack.uniqueKey}
								cachePolicy={'none'}
							/>

							<View style={styles.nowPlayingBarTextContainer}>
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
							</View>

							<View style={styles.nowPlayingBarControls}>
								<GestureDetector gesture={prevTap}>
									<RectButton style={styles.nowPlayingBarControlButton}>
										<Icon
											source='skip-previous'
											size={16}
											color={colors.onSurface}
										/>
									</RectButton>
								</GestureDetector>

								<GestureDetector gesture={playTap}>
									<RectButton style={styles.nowPlayingBarControlButton}>
										<Icon
											source={finalPlayingIndicator}
											size={24}
											color={colors.primary}
										/>
									</RectButton>
								</GestureDetector>

								<GestureDetector gesture={nextTap}>
									<RectButton style={styles.nowPlayingBarControlButton}>
										<Icon
											source='skip-next'
											size={16}
											color={colors.onSurface}
										/>
									</RectButton>
								</GestureDetector>
							</View>
						</View>
						<View
							style={[
								styles.nowPlayingBarProgressContainer,
								nowPlayingBarStyle === 'bottom'
									? { left: 0, right: 0 }
									: { width: '88%', left: 26, right: 0 },
							]}
						>
							<ProgressBar />
						</View>
					</Animated.View>
				</GestureDetector>
			)}
		</View>
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
		height: 1,
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
		height: 64,
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
