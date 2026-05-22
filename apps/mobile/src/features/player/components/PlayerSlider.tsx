import { Orpheus, useIsPlaying } from '@bbplayer/orpheus'
import Color from 'color'
import { WavySlider } from 'expo-wavy-slider'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import {
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

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
				numberOfLines={1}
				adjustsFontSizeToFit
				style={{
					color: colors.onSurfaceVariant,
					fontVariant: ['tabular-nums'],
					includeFontPadding: false,
				}}
			>
				{formatDurationToHHMMSS(position)}
			</Text>
			<Text
				variant='bodySmall'
				numberOfLines={1}
				adjustsFontSizeToFit
				style={{
					color: colors.onSurfaceVariant,
					fontVariant: ['tabular-nums'],
					includeFontPadding: false,
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
	const { position, duration, buffered } = useSmoothProgress()
	const isPlaying = useIsPlaying()

	const isScrubbing = useSharedValue(false)
	const scrubPosition = useSharedValue(0)
	const isSeeking = useSharedValue(false)
	const seekPosition = useSharedValue(0)
	const isPlayingShared = useSharedValue(isPlaying)
	const isNativeDragging = useSharedValue(false)
	const animatedWaveHeight = useSharedValue(isPlaying ? 6 : 0)
	const animatedWaveVelocity = useSharedValue(isPlaying ? 15 : 0)
	const animatedWaveThickness = useSharedValue(3)
	const animatedTrackThickness = useSharedValue(3)
	const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		isPlayingShared.set(isPlaying)
	}, [isPlaying, isPlayingShared])

	const handleSeek = useCallback(
		(time: number) => {
			if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
			isSeeking.set(true)
			void Orpheus.seekTo(time)

			seekTimeoutRef.current = setTimeout(() => {
				// Sync the actual native playback position to avoid a stale paused
				// position snapping the progress bar backward.
				void Orpheus.getPosition().then((actualPosition) => {
					position.set(actualPosition)
					isSeeking.set(false)
					seekTimeoutRef.current = null
				})
			}, 5000)
		},
		[isSeeking, position],
	)

	const displayPosition = useDerivedValue(() => {
		if (isScrubbing.value) return scrubPosition.value
		if (isSeeking.value) return seekPosition.value
		return position.value
	})

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

	useAnimatedReaction(
		() =>
			[
				isPlayingShared.value,
				isNativeDragging.value || isScrubbing.value,
			] as const,
		([playing, dragging]) => {
			const shouldShowWave = playing && !dragging
			const thickness = dragging ? 12 : 3
			animatedWaveHeight.set(
				withTiming(shouldShowWave ? 6 : 0, { duration: dragging ? 100 : 300 }),
			)
			animatedWaveVelocity.set(
				withTiming(playing ? 15 : 0, { duration: playing ? 150 : 100 }),
			)
			animatedWaveThickness.set(withTiming(thickness, { duration: 200 }))
			animatedTrackThickness.set(withTiming(thickness, { duration: 200 }))
		},
		[
			animatedTrackThickness,
			animatedWaveHeight,
			animatedWaveThickness,
			animatedWaveVelocity,
			isNativeDragging,
			isScrubbing,
			isPlayingShared,
		],
	)

	const progressFraction = useDerivedValue(() => {
		const dur = duration.value || 1
		let pos = position.value
		if (isScrubbing.value) {
			pos = scrubPosition.value
		} else if (isSeeking.value) {
			pos = seekPosition.value
		}
		return Math.min(Math.max(pos / dur, 0), 1)
	})

	const bufferedFraction = useDerivedValue(() => {
		const dur = duration.value || 1
		return Math.min(Math.max(buffered.value / dur, 0), 1)
	})

	const handleValueChange = useCallback(
		(value: number) => {
			'worklet'
			const wasScrubbing = isScrubbing.value
			isScrubbing.set(true)
			scrubPosition.set(value * (duration.value || 1))

			if (!wasScrubbing) {
				scheduleOnRN(Haptics.performHaptics, Haptics.AndroidHaptics.Drag_Start)
			}
			if (onInteraction) {
				scheduleOnRN(onInteraction)
			}
		},
		[duration, isScrubbing, onInteraction, scrubPosition],
	)

	const handleValueChangeFinished = useCallback(
		(value: number) => {
			'worklet'
			const targetTime = value * (duration.value || 1)

			seekPosition.set(targetTime)
			isSeeking.set(true)
			isScrubbing.set(false)
			scheduleOnRN(handleSeek, targetTime)
			scheduleOnRN(Haptics.performHaptics, Haptics.AndroidHaptics.Gesture_End)
			if (onInteraction) {
				scheduleOnRN(onInteraction)
			}
		},
		[duration, isScrubbing, isSeeking, onInteraction, seekPosition, handleSeek],
	)

	const handleDragStateChange = useCallback(
		(dragging: boolean) => {
			'worklet'
			isNativeDragging.set(dragging)
		},
		[isNativeDragging],
	)

	const sliderColors = useMemo(
		() => ({
			activeTrackColor: colors.primary,
			bufferedTrackColor: Color(colors.primary).alpha(0.28).rgb().string(),
			inactiveTrackColor: colors.surfaceVariant,
			thumbColor: colors.primary,
		}),
		[colors.primary, colors.surfaceVariant],
	)

	return (
		<View style={styles.root}>
			<WavySlider
				style={styles.slider}
				progress={progressFraction}
				bufferedProgress={bufferedFraction}
				colors={sliderColors}
				waveLength={30}
				waveVelocity={animatedWaveVelocity}
				waveDirection='head'
				waveHeight={animatedWaveHeight}
				waveThickness={animatedWaveThickness}
				trackThickness={animatedTrackThickness}
				incremental={false}
				onValueChange={handleValueChange}
				onValueChangeFinished={handleValueChangeFinished}
				onDragStateChange={handleDragStateChange}
			/>

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
	slider: {
		height: 25,
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
})
