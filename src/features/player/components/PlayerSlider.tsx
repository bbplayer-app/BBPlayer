import useAnimatedTrackProgress from '@/hooks/player/useAnimatedTrackProgress'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'
import { Orpheus } from '@roitium/expo-orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'
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

export function PlayerSlider() {
	const { colors } = useTheme()
	const { position, duration } = useAnimatedTrackProgress()

	const containerWidth = useSharedValue(0)
	const isScrubbing = useSharedValue(false)
	const scrubPosition = useSharedValue(0)
	const isSeeking = useSharedValue(false)
	const seekPosition = useSharedValue(0)
	const seekTimeoutRef = useRef<number | null>(null)

	const displayPosition = useDerivedValue(() => {
		if (isScrubbing.value) return scrubPosition.value
		if (isSeeking.value) return seekPosition.value
		return position.value
	})

	const handleSeek = useCallback(
		(time: number) => {
			if (seekTimeoutRef.current) {
				clearTimeout(seekTimeoutRef.current)
			}
			void Orpheus.seekTo(time)
			seekTimeoutRef.current = setTimeout(() => {
				isSeeking.set(false)
			}, 1000)
		},
		[isSeeking],
	)

	useEffect(() => {
		return () => {
			if (seekTimeoutRef.current) {
				clearTimeout(seekTimeoutRef.current)
			}
		}
	}, [])

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

	const pan = Gesture.Pan()
		.onBegin((e) => {
			if (containerWidth.value === 0) return
			isScrubbing.set(true)
			const newProgress = Math.min(Math.max(e.x / containerWidth.value, 0), 1)
			scrubPosition.set(newProgress * (duration.value || 1))
			scheduleOnRN(
				Haptics.performAndroidHapticsAsync,
				Haptics.AndroidHaptics.Drag_Start,
			)
		})
		.onUpdate((e) => {
			if (containerWidth.value === 0) return
			const newProgress = Math.min(Math.max(e.x / containerWidth.value, 0), 1)
			scrubPosition.set(newProgress * (duration.value || 1))
		})
		.onFinalize(() => {
			if (containerWidth.value === 0) return
			const targetTime = scrubPosition.value

			seekPosition.set(targetTime)
			isSeeking.set(true)

			void scheduleOnRN(handleSeek, targetTime)
			scheduleOnRN(
				Haptics.performAndroidHapticsAsync,
				Haptics.AndroidHaptics.Gesture_End,
			)

			isScrubbing.set(false)
		})
		.hitSlop({ top: 20, bottom: 20, left: 20, right: 20 })

	const trackAnimatedStyle = useAnimatedStyle(() => {
		return {
			height: trackHeight.value,
			borderRadius: trackHeight.value / 2,
		}
	})

	const activeTrackAnimatedStyle = useAnimatedStyle(() => {
		return {
			width: `${progress.value * 100}%`,
			height: trackHeight.value,
			borderRadius: trackHeight.value / 2,
		}
	})

	const thumbAnimatedStyle = useAnimatedStyle(() => {
		const translateX = progress.value * containerWidth.value - 10
		return {
			transform: [
				{ translateX },
				{ scale: withSpring(isScrubbing.value ? 1.5 : 1) },
			],
			opacity: containerWidth.value > 0 ? 1 : 0,
		}
	})

	return (
		<View>
			<GestureDetector gesture={pan}>
				<View
					style={styles.sliderContainer}
					onLayout={(e) => {
						containerWidth.value = e.nativeEvent.layout.width
					}}
				>
					{/* Background Track */}
					<Animated.View
						style={[
							styles.track,
							{ backgroundColor: colors.surfaceVariant },
							trackAnimatedStyle,
						]}
					/>

					{/* Active Track */}
					<Animated.View
						style={[
							styles.activeTrack,
							{ backgroundColor: colors.primary },
							activeTrackAnimatedStyle,
						]}
					/>

					{/* Thumb */}
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
	timeContainer: {
		marginTop: 4,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 4,
	},
	sliderContainer: {
		height: 40,
		justifyContent: 'center',
		width: '100%',
	},
	track: {
		position: 'absolute',
		width: '100%',
	},
	activeTrack: {
		position: 'absolute',
		left: 0,
	},
	thumb: {
		position: 'absolute',
		width: 15,
		height: 15,
		borderRadius: 10,
		left: 0,
		marginLeft: 0,
	},
})
