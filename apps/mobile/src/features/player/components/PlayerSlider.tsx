import { useIsPlaying } from '@bbplayer/orpheus'
import Color from 'color'
import { WavySlider } from 'expo-wavy-slider'
import { useCallback, useEffect, useMemo } from 'react'
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

import IconButton from '@/components/common/IconButton'
import {
	chapterIndexAt,
	chapterBoundaryIndex,
	chapterBoundaries,
	type Chapter,
} from '@/features/player/utils/chapters'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import useTrackProgress from '@/hooks/player/useTrackProgress'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { seekWithinTrack } from '@/lib/player/seek'
import { toastAndLogError } from '@/utils/error-handling'
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
	podcast?: boolean
	chapters?: Chapter[]
}

const NO_CHAPTERS: Chapter[] = []

export function PlayerSlider({
	onInteraction,
	podcast = false,
	chapters = NO_CHAPTERS,
}: PlayerSliderProps = {}) {
	const trackId = useCurrentTrackId()
	const { duration: nativeDuration } = useTrackProgress()
	const canSeek = Number.isFinite(nativeDuration) && nativeDuration > 0
	const markers = useMemo(
		() => (podcast ? chapterBoundaries(chapters, nativeDuration) : []),
		[chapters, nativeDuration, podcast],
	)
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
	const lastChapterHaptic = useSharedValue(0)

	useEffect(() => {
		isPlayingShared.set(isPlaying)
	}, [isPlaying, isPlayingShared])

	const handleSeek = useCallback(
		async (time: number, relative = false) => {
			if (!trackId) return
			try {
				const target = await seekWithinTrack(trackId, time, relative)
				if (target !== null) {
					position.set(target)
					seekPosition.set(target)
				}
			} catch (error) {
				toastAndLogError('跳转失败', error, 'Player.Slider')
			} finally {
				isSeeking.set(false)
			}
		},
		[trackId, position, seekPosition, isSeeking],
	)

	useEffect(() => {
		isScrubbing.set(false)
		isSeeking.set(false)
		isNativeDragging.set(false)
	}, [trackId, isScrubbing, isSeeking, isNativeDragging])

	const displayPosition = useDerivedValue(() => {
		if (isScrubbing.value) return scrubPosition.value
		if (isSeeking.value) return seekPosition.value
		return position.value
	})

	const chapterPreviewProps = useAnimatedProps(() => {
		const time = displayPosition.value
		const chapter = chapters[chapterIndexAt(chapters, time)]
		return {
			text: chapter?.title ?? '',
		}
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
			const previousFraction = scrubPosition.value / (duration.value || 1)
			isScrubbing.set(true)
			scrubPosition.set(value * (duration.value || 1))
			if (
				podcast &&
				wasScrubbing &&
				chapterBoundaryIndex(markers, value) !==
					chapterBoundaryIndex(markers, previousFraction)
			) {
				const now = Date.now()
				if (now - lastChapterHaptic.value >= 80) {
					lastChapterHaptic.set(now)
					scheduleOnRN(
						Haptics.performHaptics,
						Haptics.AndroidHaptics.Clock_Tick,
					)
				}
			}

			if (!wasScrubbing) {
				scheduleOnRN(Haptics.performHaptics, Haptics.AndroidHaptics.Drag_Start)
			}
			if (onInteraction) {
				scheduleOnRN(onInteraction)
			}
		},
		[
			duration,
			isScrubbing,
			onInteraction,
			scrubPosition,
			markers,
			podcast,
			lastChapterHaptic,
		],
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
			if (!dragging) isScrubbing.set(false)
		},
		[isNativeDragging, isScrubbing],
	)

	const sliderColors = useMemo(
		() => ({
			activeTrackColor: colors.primary,
			bufferedTrackColor: Color(colors.primary).alpha(0.28).rgb().string(),
			inactiveTrackColor: colors.surfaceVariant,
			thumbColor: colors.primary,
			activeTickColor: colors.onSurface,
			inactiveTickColor: colors.onSurface,
		}),
		[colors.primary, colors.surfaceVariant, colors.onSurface],
	)
	const sliderThumb = activeSkin?.sliderThumbs[activePlayIconIndex]
	const hasSkinSliderThumb = Boolean(sliderThumb?.normal)

	return (
		<View style={styles.root}>
			{podcast && (
				<AnimateableText
					numberOfLines={1}
					animatedProps={chapterPreviewProps}
					style={{
						color: colors.onSurfaceVariant,
						height: 24,
						textAlign: 'center',
						marginBottom: 8,
					}}
				/>
			)}
			<View style={podcast ? styles.podcastSliderRow : undefined}>
				{podcast && (
					<IconButton
						icon='rewind-15'
						accessibilityLabel='后退 15 秒'
						disabled={!canSeek}
						style={styles.seekButton}
						onPress={() => {
							void handleSeek(-15, true)
						}}
					/>
				)}
				<WavySlider
					style={podcast ? styles.podcastSlider : styles.slider}
					enabled={canSeek}
					chapterMarkers={markers}
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

				{podcast && (
					<IconButton
						icon='fast-forward-15'
						accessibilityLabel='前进 15 秒'
						disabled={!canSeek}
						style={styles.seekButton}
						onPress={() => {
							void handleSeek(15, true)
						}}
					/>
				)}
			</View>
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
	podcastSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	podcastSlider: { flex: 1, height: 48 },
	seekButton: { width: 48, height: 48, margin: 0 },
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
