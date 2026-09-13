import { RepeatMode } from '@bbplayer/orpheus'
import { useValue } from '@legendapp/state/react'
import { View } from 'react-native'
import { List, useTheme } from 'react-native-paper'

import {
	usePlaybackOptions,
	setPlayerRepeatMode,
	setPlayerShuffleMode,
} from '@/hooks/player/usePlaybackOptions'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { switchPlayerMode } from '@/lib/player/playbackSession'
import { toastAndLogError } from '@/utils/error-handling'

const report = (error: unknown) =>
	toastAndLogError('更新播放设置失败', error, 'Player.Mode')

export function PlayerModeSettings({
	onAction,
}: {
	onAction: (action: () => void) => void
}) {
	const currentMode = useValue(playbackContextStore$.context.mode)
	const { shuffle, repeat } = usePlaybackOptions()
	const { colors } = useTheme()
	return (
		<View>
			<List.Item
				title='切换播放器模式'
				left={(props) => (
					<List.Icon
						{...props}
						icon='swap-horizontal'
					/>
				)}
				onPress={() => {
					if (!currentMode) return
					const mode = currentMode === 'podcast' ? 'music' : 'podcast'
					const label = mode === 'podcast' ? '播客' : '音乐'
					onAction(() =>
						useModalStore.getState().open('Alert', {
							title: `切换到${label}模式？`,
							message: `仅在本次播放中使用${label}模式，不会更改歌单偏好或默认设置。重新开始播放时，将按歌单偏好或默认设置选择模式。`,
							buttons: [
								{ text: '取消' },
								{
									text: '切换',
									onPress: () => {
										void switchPlayerMode(mode).catch(report)
									},
								},
							],
						}),
					)
				}}
			/>
			{currentMode === 'podcast' && (
				<>
					<List.Item
						title='随机播放'
						description={shuffle ? '开启' : '关闭'}
						left={(props) => (
							<List.Icon
								{...props}
								icon={shuffle ? 'shuffle-variant' : 'shuffle-disabled'}
								color={shuffle ? colors.primary : colors.onSurfaceVariant}
							/>
						)}
						onPress={() => {
							void setPlayerShuffleMode(!shuffle).catch(report)
						}}
					/>
					<List.Item
						title='循环模式'
						description={
							repeat === RepeatMode.OFF
								? '关闭循环'
								: repeat === RepeatMode.TRACK
									? '单曲循环'
									: '队列循环'
						}
						left={(props) => (
							<List.Icon
								{...props}
								icon={
									repeat === RepeatMode.OFF
										? 'repeat-off'
										: repeat === RepeatMode.TRACK
											? 'repeat-once'
											: 'repeat'
								}
								color={
									repeat !== RepeatMode.OFF
										? colors.primary
										: colors.onSurfaceVariant
								}
							/>
						)}
						onPress={() => {
							const next =
								repeat === RepeatMode.OFF
									? RepeatMode.TRACK
									: repeat === RepeatMode.TRACK
										? RepeatMode.QUEUE
										: RepeatMode.OFF
							void setPlayerRepeatMode(next).catch(report)
						}}
					/>
				</>
			)}
		</View>
	)
}
