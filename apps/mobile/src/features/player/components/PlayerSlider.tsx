import { Orpheus } from '@roitium/expo-orpheus'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedReaction,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withSpring,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import useAnimatedTrackProgress from '@/hooks/player/useAnimatedTrackProgress'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

const THUMB_SIZE = 12

function TextWithAnimation({
	sharedPosition,
	sharedDuration,
}: {
	sharedPosition: SharedValue<number>
	sharedDuration: SharedValue<number>
}) {
	const { colors } = useTheme()
	const [duration, setDuration] = useState(0)
	const [position, setPosition] = useState(0)

	useAnimatedReaction(
		() => {
			const truncDuration = sharedDuration.value
				? Math.trunc(sharedDuration.value)
				: 0
			const truncPosition = sharedPosition.value
				? Math.trunc(sharedPosition.value)
				: 0
			return [truncDuration, truncPosition]
		},
		([curDuration, curPosition], prev) => {
			if (!prev) {
				scheduleOnRN(setDuration, curDuration)
				scheduleOnRN(setPosition, curPosition)
				return
			}
			if (curDuration !== prev[0]) {
				scheduleOnRN(setDuration, curDuration)
			}
			if (curPosition !== prev[1]) {
				scheduleOnRN(setPosition, curPosition)
			}
		},
	)

	return (
		<>
			<Text
				variant='bodySmall'
				style={{
					color: colors.onSurfaceVariant,
					fontVariant: ['tabular-nums'],
				}}
			>
				{formatDurationToHHMMSS(position)}
			</Text>
			<Text
				variant='bodySmall'
				style={{
					color: colors.onSurfaceVariant,
					fontVariant: ['tabular-nums'],
				}}
			>
				{formatDurationToHHMMSS(duration)}
			</Text>
		</>
	)
}

interface PlayerSliderProps {
	onInteraction?: () => void
}

export function PlayerSlider({ onInteraction }: PlayerSliderProps = {}) {
	const { colors } = useTheme()
	const { position, duration, buffered } = useAnimatedTrackProgress()

	const containerWidth = useSharedValue(0)
	const isScrubbing = useSharedValue(false)
	const scrubPosition = useSharedValue(0)
	const isSeeking = useSharedValue(false)
	const seekPosition = useSharedValue(0)
	const seekTimeoutRef = useRef<number | null>(null)
	const sliderContainerRef = useRef<View>(null)

	const displayPosition = useDerivedValue(() => {
		if (isScrubbing.value) return scrubPosition.value
		if (isSeeking.value) return seekPosition.value
		return position.value
	})

	const handleSeek = useCallback(
		(time: number) => {
			if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
			isSeeking.set(true)
			void Orpheus.seekTo(time)

			seekTimeoutRef.current = setTimeout(() => {
				// 获取实际播放位置并同步，避免暂停状态下 position 未更新导致进度条回退
				void Orpheus.getPosition().then((actualPosition) => {
					position.set(actualPosition)
					isSeeking.set(false)
					seekTimeoutRef.current = null
				})
			}, 5000)
		},
		[isSeeking, position],
	)

	useAnimatedReaction(
		() => position.value,
		(currentPosition) => {
			if (!isSeeking.value) return
			const target = seekPosition.value
			const threshold = 1
			const diff = Math.abs(currentPosition - target)
			if (diff < threshold) {
				isSeeking.set(false)
			}
		},
		[position, isSeeking, seekPosition],
	)

	const progress = useDerivedValue(() => {
		const dur = duration.value || 1
		let pos = position.value
		if (isScrubbing.value) {
			pos = scrubPosition.value
		} else if (isSeeking.value) {
			pos = seekPosition.value
		}
		return Math.min(Math.max(pos / dur, 0), 1)
	})

	const trackHeight = useDerivedValue(() => {
		return withTiming(isScrubbing.value ? 12 : 4, { duration: 200 })
	})

	useLayoutEffect(() => {
		if (sliderContainerRef.current) {
			sliderContainerRef.current.measure((_x, _y, width) => {
				if (width > 0) {
					containerWidth.set(width)
				}
			})
		}
	}, [containerWidth])

	const pan = useMemo(
		() =>
			Gesture.Pan()
				.onBegin((e) => {
					if (containerWidth.value === 0) return
					isScrubbing.set(true)
					const newProgress = Math.min(
						Math.max(e.x / containerWidth.value, 0),
						1,
					)
					scrubPosition.set(newProgress * (duration.value || 1))
					scheduleOnRN(
						Haptics.performHaptics,
						Haptics.AndroidHaptics.Drag_Start,
					)
					if (onInteraction) {
						scheduleOnRN(onInteraction)
					}
				})
				.onUpdate((e) => {
					if (containerWidth.value === 0) return
					const newProgress = Math.min(
						Math.max(e.x / containerWidth.value, 0),
						1,
					)
					scrubPosition.set(newProgress * (duration.value || 1))
					if (onInteraction) {
						scheduleOnRN(onInteraction)
					}
				})
				.onFinalize(() => {
					if (containerWidth.value === 0) return
					const targetTime = scrubPosition.value

					seekPosition.set(targetTime)
					isSeeking.set(true)

					void scheduleOnRN(handleSeek, targetTime)
					scheduleOnRN(
						Haptics.performHaptics,
						Haptics.AndroidHaptics.Gesture_End,
					)
					if (onInteraction) {
						scheduleOnRN(onInteraction)
					}

					isScrubbing.set(false)
				})
				.hitSlop({ top: 20, bottom: 20, left: 20, right: 20 }),
		[
			containerWidth,
			isScrubbing,
			scrubPosition,
			duration,
			onInteraction,
			seekPosition,
			isSeeking,
			handleSeek,
		],
	)

	const trackAnimatedStyle = useAnimatedStyle(() => {
		return {
			height: trackHeight.value,
			borderRadius: trackHeight.value / 2,
			overflow: 'hidden',
		}
	})

	const activeTrackInnerStyle = useAnimatedStyle(() => {
		const translateX = (progress.value - 1) * containerWidth.value
		return {
			transform: [{ translateX }],
			width: containerWidth.value,
			height: '100%',
		}
	})

	const bufferedProgress = useDerivedValue(() => {
		const dur = duration.value || 1
		const buf = buffered.value
		return Math.min(Math.max(buf / dur, 0), 1)
	})

	const bufferedTrackInnerStyle = useAnimatedStyle(() => {
		const translateX = (bufferedProgress.value - 1) * containerWidth.value
		return {
			transform: [{ translateX }],
			width: containerWidth.value,
			height: '100%',
		}
	})

	const thumbAnimatedStyle = useAnimatedStyle(() => {
		const translateX = progress.value * containerWidth.value - THUMB_SIZE / 2
		return {
			transform: [
				{ translateX },
				{ scale: withSpring(isScrubbing.value ? 1.5 : 1) },
			],
			opacity: containerWidth.value > 0 ? 1 : 0,
		}
	})

	return (
		<View style={styles.root}>
			<GestureDetector gesture={pan}>
				<View
					style={styles.sliderContainer}
					ref={sliderContainerRef}
				>
					<Animated.View
						style={[
							styles.track,
							{ backgroundColor: colors.surfaceVariant },
							trackAnimatedStyle,
						]}
					>
						<Animated.View
							style={[
								styles.trackItem,
								{ backgroundColor: colors.inverseSurface, opacity: 0.3 },
								bufferedTrackInnerStyle,
							]}
						/>
						<Animated.View
							style={[
								styles.trackItem,
								{ backgroundColor: colors.primary },
								activeTrackInnerStyle,
							]}
						/>
					</Animated.View>

					<Animated.View
						style={[
							styles.thumb,
							{ backgroundColor: colors.primary },
							thumbAnimatedStyle,
						]}
					/>
				</View>
			</GestureDetector>

			<View style={styles.timeContainer}>
				<TextWithAnimation
					sharedPosition={displayPosition}
					sharedDuration={duration}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		width: '100%',
		justifyContent: 'center',
	},
	sliderContainer: {
		height: 40,
		justifyContent: 'center',
		width: '90%',
		alignSelf: 'center',
	},
	timeContainer: {
		marginTop: 4,
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '90%',
		alignSelf: 'center',
	},
	track: {
		position: 'absolute',
		width: '100%',
		left: 0,
	},
	thumb: {
		position: 'absolute',
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: THUMB_SIZE / 2,
		left: 0,
	},
	trackItem: {
		position: 'absolute',
		left: 0,
		top: 0,
	},
})
