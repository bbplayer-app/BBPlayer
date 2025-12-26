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
import { useEffect, useState } from 'react'
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

	const finalPlayingIndicator =
		state === PlaybackState.BUFFERING ? 'loading' : isPlaying ? 'pause' : 'play'

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
							void Orpheus.pause().catch((e) => logInstance.error('pause', e))
						} else {
							void Orpheus.play().catch((e) => logInstance.error('play', e))
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
