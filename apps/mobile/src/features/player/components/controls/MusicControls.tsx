import { RepeatMode } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	usePlaybackOptions,
	setPlayerRepeatMode,
	setPlayerShuffleMode,
} from '@/hooks/player/usePlaybackOptions'
import { analyticsService } from '@/lib/services/analyticsService'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'

import {
	MainPlaybackControls,
	SecondaryPlaybackControls,
} from './PlayerControlContent'

export function MusicControls({ onOpenQueue }: { onOpenQueue: () => void }) {
	const { colors } = useTheme()
	const { shuffle: shuffleMode, repeat: repeatMode } = usePlaybackOptions()
	const currentTrack = useCurrentTrack()
	const router = useRouter()

	return (
		<View>
			<View style={{ marginTop: 24 }}>
				<MainPlaybackControls />
			</View>
			<SecondaryPlaybackControls>
				<IconButton
					icon={shuffleMode ? 'shuffle-variant' : 'shuffle-disabled'}
					size={24}
					iconColor={shuffleMode ? colors.primary : colors.onSurfaceVariant}
					onPress={async () => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
						try {
							await setPlayerShuffleMode(!shuffleMode)
						} catch (error) {
							toastAndLogError('修改随机播放失败', error, 'Player.Controls')
							return
						}
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
						void setPlayerRepeatMode(nextMode).catch((error: unknown) =>
							toastAndLogError('修改循环模式失败', error, 'Player.Controls'),
						)
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
			</SecondaryPlaybackControls>
		</View>
	)
}
