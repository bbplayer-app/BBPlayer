import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import * as Haptics from '@/utils/haptics'
import logInstance from '@/utils/log'
import {
	Orpheus,
	PlaybackState,
	RepeatMode,
	useIsPlaying,
	usePlaybackState,
} from '@roitium/expo-orpheus'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { IconButton, Tooltip, useTheme } from 'react-native-paper'

export function PlayerControls({ onOpenQueue }: { onOpenQueue: () => void }) {
	const { colors } = useTheme()
	const isPlaying = useIsPlaying()
	const state = usePlaybackState()
	const { data: shuffleMode, refetch: refetchShuffleMode } = useQuery({
		queryKey: ['shuffleMode'],
		queryFn: () => Orpheus.getShuffleMode(),
		gcTime: 0,
		staleTime: 0,
	})
	const [repeatMode, setRepeatMode] = useState(RepeatMode.OFF)
	const currentTrack = useCurrentTrack()
	const router = useRouter()

	// 对 BUFFERING 状态和 isPlaying 状态添加防抖，避免 seek 时短暂闪烁图标
	const [debouncedBuffering, setDebouncedBuffering] = useState(false)
	const [debouncedIsPlaying, setDebouncedIsPlaying] = useState(isPlaying)
	const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const playingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (state === PlaybackState.BUFFERING) {
			bufferingTimeoutRef.current = setTimeout(() => {
				setDebouncedBuffering(true)
			}, 200)
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

	const finalPlayingIndicator = debouncedBuffering
		? 'loading'
		: debouncedIsPlaying
			? 'pause'
			: 'play'

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
			<View style={styles.mainControlsContainer}>
				<IconButton
					icon='skip-previous'
					size={32}
					onPress={() => {
						void Haptics.performAndroidHapticsAsync(
							Haptics.AndroidHaptics.Context_Click,
						)
						void Orpheus.skipToPrevious()
					}}
				/>
				<IconButton
					icon={finalPlayingIndicator}
					size={48}
					onPress={async () => {
						void Haptics.performAndroidHapticsAsync(
							Haptics.AndroidHaptics.Context_Click,
						)
						const isPlaying = await Orpheus.getIsPlaying()
						logInstance.debug('isPlaying', isPlaying)
						if (isPlaying) {
							await Orpheus.pause()
						} else {
							// 或许可以解决 play 无响应的问题？
							// 好吧并不能，我是小丑
							await Orpheus.pause()
							await Orpheus.play()
						}
					}}
					mode='contained'
				/>
				<IconButton
					icon='skip-next'
					size={32}
					onPress={() => {
						void Haptics.performAndroidHapticsAsync(
							Haptics.AndroidHaptics.Context_Click,
						)
						void Orpheus.skipToNext()
					}}
				/>
			</View>
			<View style={styles.secondaryControlsContainer}>
				<Tooltip title='切换随机播放模式'>
					<IconButton
						icon={shuffleMode ? 'shuffle-variant' : 'shuffle-disabled'}
						size={24}
						iconColor={shuffleMode ? colors.primary : colors.onSurfaceVariant}
						onPress={async () => {
							void Haptics.performAndroidHapticsAsync(
								Haptics.AndroidHaptics.Confirm,
							)
							await (shuffleMode
								? Orpheus.setShuffleMode(false)
								: Orpheus.setShuffleMode(true))
							await refetchShuffleMode()
						}}
					/>
				</Tooltip>
				<Tooltip title='切换循环播放模式'>
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
							void Haptics.performAndroidHapticsAsync(
								Haptics.AndroidHaptics.Confirm,
							)
							const nextMode =
								repeatMode === RepeatMode.OFF
									? RepeatMode.TRACK
									: repeatMode === RepeatMode.TRACK
										? RepeatMode.QUEUE
										: RepeatMode.OFF
							void Orpheus.setRepeatMode(nextMode)
							setRepeatMode(nextMode)
						}}
					/>
				</Tooltip>
				<Tooltip title='查看评论'>
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
					/>
				</Tooltip>
				<Tooltip title='打开播放列表'>
					<IconButton
						icon='format-list-bulleted'
						size={24}
						iconColor={colors.onSurfaceVariant}
						onPress={() => {
							void Haptics.performAndroidHapticsAsync(
								Haptics.AndroidHaptics.Context_Click,
							)
							onOpenQueue()
						}}
					/>
				</Tooltip>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	mainControlsContainer: {
		marginTop: 24,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 40,
	},
	secondaryControlsContainer: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 32,
	},
})
