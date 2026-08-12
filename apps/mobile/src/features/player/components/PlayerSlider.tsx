import { Orpheus, useIsPlaying } from '@bbplayer/orpheus'
import Color from 'color'
import { WavySlider } from 'expo-wavy-slider'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import AnimateableText from 'react-native-animateable-text'
import { useTheme } from 'react-native-paper'
import {
	useAnimatedProps,
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

function TextWithAnimation({
	sharedPosition,
	sharedDuration,
}: {
	sharedPosition: SharedValue<number>
	sharedDuration: SharedValue<number>
}) {
	const { colors, fonts } = useTheme()

	const positionText = useSharedValue('00:00')
	const durationText = useSharedValue('00:00')

	useAnimatedReaction(
		() => (sharedPosition.value ? Math.trunc(sharedPosition.value) : 0),
		(pos, prev) => {
			if (pos !== prev) {
				positionText.value = formatDurationToHHMMSS(pos)
			}
		},
	)

	useAnimatedReaction(
		() => (sharedDuration.value ? Math.trunc(sharedDuration.value) : 0),
		(dur, prev) => {
			if (dur !== prev) {
				durationText.value = formatDurationToHHMMSS(dur)
			}
		},
	)

	const textStyle = useMemo(
		() => ({
			...fonts.bodySmall,
			color: colors.onSurfaceVariant,
			fontVariant: ['tabular-nums'],
			includeFontPadding: false,
		}),
		[colors.onSurfaceVariant, fonts.bodySmall],
	)
	const positionTextProp = useAnimatedProps(() => {
		return {
			text: positionText.value,
		}
	})
	const durationTextProp = useAnimatedProps(() => {
		return {
			text: durationText.value,
		}
	})

	return (
		<>
			<AnimateableText
				numberOfLines={1}
				adjustsFontSizeToFit
				style={textStyle}
				animatedProps={positionTextProp}
			/>
			<AnimateableText
				numberOfLines={1}
				adjustsFontSizeToFit
				style={textStyle}
				animatedProps={durationTextProp}
			/>
		</>
	)
}

interface PlayerSliderProps {
	onInteraction?: () => void
}

export function PlayerSlider({ onInteraction }: PlayerSliderProps = {}) {
	const { colors } = useTheme()
	const activeSkin = useActiveSkin()
	const skinSliderThumbSize = useSkinStore(
		(state) => state.skinSliderThumbSize ?? 20,
	)
	const skinSliderThumbOffsetX = useSkinStore(
		(state) => state.skinSliderThumbOffsetX ?? 0,
	)
	const skinSliderThumbOffsetY = useSkinStore(
		(state) => state.skinSliderThumbOffsetY ?? 0,
	)
	const activePlayIconIndex = useSkinStore((state) => state.activePlayIconIndex)
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

	// oxlint-disable-next-line no-underscore-dangle
	const _bufferedFraction = useDerivedValue(() => {
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
	const sliderThumb = activeSkin?.sliderThumbs[activePlayIconIndex]
	const hasSkinSliderThumb = Boolean(sliderThumb?.normal)

	return (
		<View style={styles.root}>
			<WavySlider
				style={styles.slider}
				progress={progressFraction}
				// bufferedProgress={bufferedFraction} 缓冲进度条在使用自定义 slider 时会出现一些样式问题，懒得修复了，反正音乐播放器不是很需要这个东西。
				colors={sliderColors}
				waveLength={30}
				waveVelocity={animatedWaveVelocity}
				waveDirection='head'
				waveHeight={animatedWaveHeight}
				waveThickness={animatedWaveThickness}
				trackThickness={animatedTrackThickness}
				thumbImageUri={sliderThumb?.normal}
				thumbImageDragLeftUri={sliderThumb?.dragLeft}
				thumbImageDragRightUri={sliderThumb?.dragRight}
				thumbImageSize={hasSkinSliderThumb ? skinSliderThumbSize : undefined}
				thumbImageOffsetX={
					hasSkinSliderThumb ? skinSliderThumbOffsetX : undefined
				}
				thumbImageOffsetY={
					hasSkinSliderThumb ? skinSliderThumbOffsetY : undefined
				}
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
