import {
	Orpheus,
	PlaybackState,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import LottieView, { type AnimationObject } from 'lottie-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import useTrackDuration from '@/hooks/player/useTrackProgress'
import { seekWithinTrack } from '@/lib/player/seek'
import { analyticsService } from '@/lib/services/analyticsService'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { tintLottieSource } from '@/utils/lottie'

const skipPrevSource =
	require('@/assets/lottie/skip-prev.json') as AnimationObject

const skipNextSource =
	require('@/assets/lottie/skip-next.json') as AnimationObject

const playPauseSource =
	require('@/assets/lottie/play-pause.json') as AnimationObject

const rewind15Source =
	require('@/assets/lottie/rewind-15.json') as AnimationObject

const forward15Source =
	require('@/assets/lottie/fast-forward-15.json') as AnimationObject

interface MainPlaybackControlsProps {
	size?: 'normal' | 'compact'
	onInteraction?: () => void
	podcast?: boolean
}

/**
 * 主播放控制按钮：音乐切歌，播客前后跳转 15 秒。
 * 可在主播放器和歌词页面复用
 */
export function MainPlaybackControls({
	size = 'normal',
	onInteraction,
	podcast = false,
}: MainPlaybackControlsProps) {
	const { colors } = useTheme()
	const isPlaying = useIsPlaying()
	const state = usePlaybackState()

	// 对 isPlaying 状态添加防抖，避免 seek 时短暂闪烁图标
	const [debouncedIsPlaying, setDebouncedIsPlaying] = useState(isPlaying)
	const [debouncedBuffering, setDebouncedBuffering] = useState(false)
	const playingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const prevLottieRef = useRef<LottieView>(null)
	const nextLottieRef = useRef<LottieView>(null)
	const playPauseLottieRef = useRef<LottieView>(null)
	const isFirstMount = useRef(true)

	useEffect(() => {
		if (state === PlaybackState.BUFFERING) {
			if (bufferingTimeoutRef.current) {
				clearTimeout(bufferingTimeoutRef.current)
				bufferingTimeoutRef.current = null
			}

			bufferingTimeoutRef.current = setTimeout(() => {
				setDebouncedBuffering(true)
			}, 300)
		} else {
			if (bufferingTimeoutRef.current) {
				clearTimeout(bufferingTimeoutRef.current)
				bufferingTimeoutRef.current = null
			}

			setDebouncedBuffering(false)
		}

		return () => {
			if (bufferingTimeoutRef.current) {
				clearTimeout(bufferingTimeoutRef.current)
			}
		}
	}, [state])

	useEffect(() => {
		if (playingTimeoutRef.current) {
			clearTimeout(playingTimeoutRef.current)
			playingTimeoutRef.current = null
		}

		if (isPlaying) {
			// 播放状态立即更新
			setDebouncedIsPlaying(true)
		} else {
			// 暂停状态延迟更新，避免 seek 时短暂闪烁
			playingTimeoutRef.current = setTimeout(() => {
				setDebouncedIsPlaying(false)
			}, 200)
		}

		return () => {
			if (playingTimeoutRef.current) {
				clearTimeout(playingTimeoutRef.current)
			}
		}
	}, [isPlaying])

	useEffect(() => {
		if (isFirstMount.current) {
			isFirstMount.current = false

			if (debouncedIsPlaying) {
				playPauseLottieRef.current?.play(0, 0)
			} else {
				playPauseLottieRef.current?.play(8, 8)
			}

			return
		}

		if (debouncedIsPlaying) {
			playPauseLottieRef.current?.play(8, 0)
		} else {
			playPauseLottieRef.current?.play(0, 8)
		}
	}, [debouncedIsPlaying, debouncedBuffering])

	const skipButtonSize = size === 'compact' ? 40 : 46
	const playButtonSize = size === 'compact' ? 80 : 96
	const gap = size === 'compact' ? 24 : 40

	// 我知道这 tmd 是一种究极无敌肮脏的 hack，但没办法，colorFilters 不生效啊...
	const tintedSkipPrev = useMemo(
		() => tintLottieSource(skipPrevSource, colors.onSurfaceVariant),
		[colors.onSurfaceVariant],
	)

	const tintedPlayPause = useMemo(
		() => tintLottieSource(playPauseSource, colors.primary),
		[colors.primary],
	)

	const tintedSkipNext = useMemo(
		() => tintLottieSource(skipNextSource, colors.onSurfaceVariant),
		[colors.onSurfaceVariant],
	)

	return (
		<View style={[styles.mainControlsContainer, { gap }]}>
			{podcast ? (
				<PodcastSeekButton
					seconds={-15}
					size={size}
					onInteraction={onInteraction}
				/>
			) : (
				<Touchable
					androidRipple={{}}
					style={{
						width: skipButtonSize,
						height: skipButtonSize,
						justifyContent: 'center',
						alignItems: 'center',
						borderRadius: 99999,
					}}
					onPress={() => {
						onInteraction?.()
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						prevLottieRef.current?.play(0, 60)
						void Orpheus.skipToPrevious()
						void analyticsService.logPlayerAction('skip_prev')
					}}
					testID='player-prev'
				>
					<LottieView
						ref={prevLottieRef}
						source={tintedSkipPrev}
						style={{ width: '100%', height: '100%' }}
						autoPlay={false}
						speed={2}
						loop={false}
					/>
				</Touchable>
			)}
			<Touchable
				androidRipple={{}}
				style={{
					width: playButtonSize,
					height: playButtonSize,
					justifyContent: 'center',
					alignItems: 'center',
					borderRadius: 99999,
				}}
				onPress={async () => {
					onInteraction?.()
					void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)

					const nextIsPlaying = !debouncedIsPlaying
					setDebouncedIsPlaying(nextIsPlaying)

					try {
						if (debouncedIsPlaying) {
							await Orpheus.pause()
							void analyticsService.logPlayerAction('pause')
						} else {
							await Orpheus.play()
							void analyticsService.logPlayerAction('play')
						}
					} catch (e) {
						toastAndLogError('播放操作失败', e, 'UI.Player.Controls')
					}
				}}
				testID={debouncedIsPlaying ? 'player-pause' : 'player-play'}
				accessibilityRole='button'
				accessibilityLabel={debouncedIsPlaying ? '暂停' : '播放'}
			>
				{debouncedBuffering ? (
					<ActivityIndicator
						size={playButtonSize * 0.6}
						color={colors.primary}
					/>
				) : (
					<LottieView
						ref={playPauseLottieRef}
						source={tintedPlayPause}
						style={{ width: '100%', height: '100%' }}
						autoPlay={false}
						speed={2}
						loop={false}
					/>
				)}
			</Touchable>
			{podcast ? (
				<PodcastSeekButton
					seconds={15}
					size={size}
					onInteraction={onInteraction}
				/>
			) : (
				<Touchable
					androidRipple={{}}
					style={{
						width: skipButtonSize,
						height: skipButtonSize,
						justifyContent: 'center',
						alignItems: 'center',
						borderRadius: 99999,
					}}
					onPress={() => {
						onInteraction?.()
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						nextLottieRef.current?.play(0, 60)
						void Orpheus.skipToNext()
						void analyticsService.logPlayerAction('skip_next')
					}}
					testID='player-next'
				>
					<LottieView
						ref={nextLottieRef}
						source={tintedSkipNext}
						style={{ width: '100%', height: '100%' }}
						autoPlay={false}
						speed={2}
						loop={false}
					/>
				</Touchable>
			)}
		</View>
	)
}

function PodcastSeekButton({
	seconds,
	size,
	onInteraction,
}: {
	seconds: -15 | 15
	size: 'normal' | 'compact'
	onInteraction?: () => void
}) {
	const trackId = useCurrentTrackId()
	const duration = useTrackDuration()
	const { colors } = useTheme()
	const animation = useRef<LottieView>(null)
	const compact = size === 'compact'
	const buttonSize = compact ? 56 : 64
	const canSeek = !!trackId && Number.isFinite(duration) && duration > 0
	const iconColor = canSeek ? colors.onSurfaceVariant : colors.onSurfaceDisabled

	const source = useMemo(
		() =>
			tintLottieSource(
				seconds < 0 ? rewind15Source : forward15Source,
				iconColor,
			),
		[seconds, iconColor],
	)

	// The 32px animation canvas gives the rotating 24px icon room to move.
	const animationSize = ((compact ? 32 : 36) * 32) / 24

	return (
		<Touchable
			androidRipple={{}}
			style={{
				width: buttonSize,
				height: buttonSize,
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: buttonSize / 2,
				overflow: 'hidden',
				opacity: canSeek ? 1 : 0.38,
			}}
			testID={seconds < 0 ? 'player-rewind-15' : 'player-forward-15'}
			accessibilityRole='button'
			accessibilityLabel={seconds < 0 ? '后退 15 秒' : '前进 15 秒'}
			accessibilityState={{ disabled: !canSeek }}
			disabled={!canSeek}
			onPress={() => {
				if (!canSeek) return
				animation.current?.reset()
				animation.current?.play(0, 30)
				onInteraction?.()
				void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
				void seekWithinTrack(trackId, seconds, true).catch((error: unknown) => {
					toastAndLogError('跳转失败', error, 'Player.Controls')
				})
			}}
		>
			<LottieView
				ref={animation}
				source={source}
				style={{ width: animationSize, height: animationSize }}
				autoPlay={false}
				loop={false}
			/>
		</Touchable>
	)
}

export function SecondaryPlaybackControls({
	children,
	compact = false,
}: {
	children: React.ReactNode
	compact?: boolean
}) {
	return (
		<View
			style={[
				styles.secondaryControlsContainer,
				compact && { gap: 12, marginTop: 4 },
			]}
		>
			{children}
		</View>
	)
}

const styles = StyleSheet.create({
	mainControlsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	secondaryControlsContainer: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 32,
	},
})
