import { useIsPlaying } from '@bbplayer/orpheus'
import Color from 'color'
import { WavySlider } from 'expo-wavy-slider'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import AnimateableText from 'react-native-animateable-text'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
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

import { usePlayerChapters } from '@/features/player/hooks/usePlayerChapters'
import {
	chapterIndexAt,
	chapterBoundaryIndex,
	chapterBoundaries,
} from '@/features/player/utils/chapters'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import useTrackDuration from '@/hooks/player/useTrackProgress'
import useAppStore from '@/hooks/stores/useAppStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { seekWithinTrack } from '@/lib/player/seek'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

const isIOS = Platform.OS === 'ios'
const SLIDER_WIDTH_PERCENT = 90
const ACCESSIBILITY_SEEK_SECONDS = 10

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
				positionText.set(formatDurationToHHMMSS(pos))
			}
		},
	)

	useAnimatedReaction(
		() => (sharedDuration.value ? Math.trunc(sharedDuration.value) : 0),
		(dur, prev) => {
			if (dur !== prev) {
				durationText.set(formatDurationToHHMMSS(dur))
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
				testID='player-elapsed-time'
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
	showChapterTitle?: boolean
}

export function PlayerSlider({
	onInteraction,
	showChapterTitle = true,
}: PlayerSliderProps = {}) {
	const trackId = useCurrentTrackId()
	const nativeDuration = useTrackDuration()
	const { chapters, podcast } = usePlayerChapters()
	const canSeek = Number.isFinite(nativeDuration) && nativeDuration > 0
	const markers = useMemo(
		() => (podcast ? chapterBoundaries(chapters, nativeDuration) : []),
		[chapters, nativeDuration, podcast],
	)
	const { colors } = useTheme()
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)
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
				isSeeking.set(false)
			} catch (error) {
				toastAndLogError('跳转失败', error, 'Player.Slider')
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

	// 进度在 UI 线程上，无障碍属性拿不到；iOS 上每 5 秒同步一份给 VoiceOver。
	const [spokenPosition, setSpokenPosition] = useState('00:00')
	useAnimatedReaction(
		() => (isIOS ? Math.trunc(displayPosition.value / 5) * 5 : 0),
		(seconds, previous) => {
			if (seconds !== previous) {
				scheduleOnRN(setSpokenPosition, formatDurationToHHMMSS(seconds))
			}
		},
	)

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

	const sliderWidth = useSharedValue(0)
	const scrubActivated = useSharedValue(false)
	const trackRatio = podcast ? 1 : SLIDER_WIDTH_PERCENT / 100
	const toFraction = (x: number) => {
		'worklet'
		// 手势区域占满整行，非播客模式下可见轨道居中且更窄，要换算成轨道上的位置。
		const trackWidth = sliderWidth.value * trackRatio
		if (trackWidth <= 0) return 0
		const trackLeft = (sliderWidth.value - trackWidth) / 2
		return Math.min(Math.max((x - trackLeft) / trackWidth, 0), 1)
	}

	// iOS 的滑块由这个手势驱动：手指一动就激活，才能抢在原生的分页和返回手势之前。
	const scrubGesture = usePanGesture({
		enabled: canSeek,
		minDistance: 0,
		hitSlop: { vertical: 10 },
		onBegin: (event) => {
			'worklet'
			scrubActivated.set(false)
			handleDragStateChange(true)
			handleValueChange(toFraction(event.x))
		},
		onActivate: () => {
			'worklet'
			scrubActivated.set(true)
		},
		onUpdate: (event) => {
			'worklet'
			handleValueChange(toFraction(event.x))
		},
		onFinalize: (event) => {
			'worklet'
			// 手指没动的点按不会激活手势，结束时同样带 canceled，只有拖动中途被打断才放弃跳转。
			if (!event.canceled || !scrubActivated.value) {
				handleValueChangeFinished(toFraction(event.x))
			}
			handleDragStateChange(false)
		},
	})

	const sliderColors = useMemo(
		() => ({
			activeTrackColor: colors.primary,
			bufferedTrackColor: Color(colors.primary).alpha(0.28).rgb().string(),
			inactiveTrackColor: pureWhiteBackground
				? colors.outlineVariant
				: colors.surfaceVariant,
			thumbColor: colors.primary,
			activeTickColor: colors.onSurface,
			inactiveTickColor: colors.onSurface,
		}),
		[
			colors.primary,
			colors.surfaceVariant,
			colors.onSurface,
			colors.outlineVariant,
			pureWhiteBackground,
		],
	)
	const sliderThumb = activeSkin?.sliderThumbs[activePlayIconIndex]
	const hasSkinSliderThumb = Boolean(sliderThumb?.normal)

	const slider = (
		<WavySlider
			style={podcast ? styles.podcastSlider : styles.slider}
			enabled={!isIOS && canSeek}
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
	)

	return (
		<View style={styles.root}>
			{podcast && showChapterTitle && (
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
			{isIOS ? (
				<GestureDetector gesture={scrubGesture}>
					<View
						accessible
						accessibilityRole='adjustable'
						accessibilityLabel='播放进度'
						accessibilityValue={{ text: spokenPosition }}
						accessibilityActions={[
							{ name: 'increment' },
							{ name: 'decrement' },
						]}
						onAccessibilityAction={(event) => {
							const direction =
								event.nativeEvent.actionName === 'increment' ? 1 : -1
							void handleSeek(direction * ACCESSIBILITY_SEEK_SECONDS, true)
						}}
						onLayout={(event) => {
							sliderWidth.set(event.nativeEvent.layout.width)
						}}
					>
						{slider}
					</View>
				</GestureDetector>
			) : (
				<View>{slider}</View>
			)}
			<View
				style={[styles.timeContainer, podcast && styles.podcastTimeContainer]}
			>
				<TextWithAnimation
					sharedPosition={displayPosition}
					sharedDuration={duration}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	podcastSlider: { width: '100%', height: 25 },
	podcastTimeContainer: { width: '100%' },
	root: {
		width: '100%',
		justifyContent: 'center',
	},
	slider: {
		height: 25,
		width: `${SLIDER_WIDTH_PERCENT}%` as const,
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
