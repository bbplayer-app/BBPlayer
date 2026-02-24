import {
	Orpheus,
	PlaybackState,
	RepeatMode,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import LottieView, { type AnimationObject } from 'lottie-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { ActivityIndicator, useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useShuffleMode } from '@/hooks/queries/orpheus'
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

interface MainPlaybackControlsProps {
	size?: 'normal' | 'compact'
	onInteraction?: () => void
}

/**
 * 主播放控制按钮组件（上一曲/播放暂停/下一曲）
 * 可在主播放器和歌词页面复用
 */
export function MainPlaybackControls({
	size = 'normal',
	onInteraction,
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
			<RectButton
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
			</RectButton>
			<RectButton
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
				testID='player-play-pause'
			>
				{debouncedBuffering ? (
					<ActivityIndicator
						size={playButtonSize * 0.4}
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
			</RectButton>
			<RectButton
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
			</RectButton>
		</View>
	)
}

export function PlayerControls({ onOpenQueue }: { onOpenQueue: () => void }) {
	const { colors } = useTheme()
	const { data: shuffleMode, refetch: refetchShuffleMode } = useShuffleMode()
	const [repeatMode, setRepeatMode] = useState(RepeatMode.OFF)
	const currentTrack = useCurrentTrack()
	const router = useRouter()

	useEffect(() => {
		void Orpheus.getRepeatMode().then(setRepeatMode)
		const listener = AppState.addEventListener('change', (nextAppState) => {
			if (nextAppState === 'active') {
				void Orpheus.getRepeatMode().then(setRepeatMode)
			}
		})
		return () => {
			listener.remove()
		}
	}, [])

	return (
		<View>
			<View style={styles.mainControlsWrapper}>
				<MainPlaybackControls />
			</View>
			<View style={styles.secondaryControlsContainer}>
				<IconButton
					icon={shuffleMode ? 'shuffle-variant' : 'shuffle-disabled'}
					size={24}
					iconColor={shuffleMode ? colors.primary : colors.onSurfaceVariant}
					onPress={async () => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
						await (shuffleMode
							? Orpheus.setShuffleMode(false)
							: Orpheus.setShuffleMode(true))
						await refetchShuffleMode()
						void analyticsService.logPlayerAction('shuffle', {
							mode: !shuffleMode,
						})
					}}
					testID='player-mode-shuffle'
				/>
				<IconButton
					icon={
						repeatMode === RepeatMode.OFF
							? 'repeat-off'
							: repeatMode === RepeatMode.TRACK
								? 'repeat-once'
								: 'repeat'
					}
					size={24}
					iconColor={
						repeatMode !== RepeatMode.OFF
							? colors.primary
							: colors.onSurfaceVariant
					}
					onPress={() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
						const nextMode =
							repeatMode === RepeatMode.OFF
								? RepeatMode.TRACK
								: repeatMode === RepeatMode.TRACK
									? RepeatMode.QUEUE
									: RepeatMode.OFF
						void Orpheus.setRepeatMode(nextMode)
						setRepeatMode(nextMode)
						void analyticsService.logPlayerAction('repeat', {
							mode: nextMode,
						})
					}}
					testID='player-mode-repeat'
				/>
				<IconButton
					icon='comment-text-outline'
					size={24}
					disabled={currentTrack?.source !== 'bilibili'}
					onPress={() => {
						if (currentTrack?.source === 'bilibili') {
							router.push({
								pathname: '/comments/[bvid]',
								params: { bvid: currentTrack.bilibiliMetadata.bvid },
							})
						}
					}}
					testID='player-open-comments'
				/>
				<IconButton
					icon='format-list-bulleted'
					size={24}
					iconColor={colors.onSurfaceVariant}
					onPress={() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						onOpenQueue()
						void analyticsService.logPlayerQueueAction('open_queue')
					}}
					testID='player-open-queue'
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	mainControlsWrapper: {
		marginTop: 24,
	},
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
