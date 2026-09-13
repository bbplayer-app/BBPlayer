import { RepeatMode } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { Divider, List, useTheme } from 'react-native-paper'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	usePlaybackOptions,
	setPlayerRepeatMode,
	setPlayerShuffleMode,
} from '@/hooks/player/usePlaybackOptions'
import { toastAndLogError } from '@/utils/error-handling'

import {
	HighFreqButton,
	HighFreqRow,
	PlayerDownloadButton,
	PlayerModeSwitch,
	SharedTrackActions,
	ShareSongAction,
	type PlayerMenuContentProps,
} from './PlayerMenuContent'

export function PodcastFunctionalMenu({ onAction }: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const router = useRouter()
	return (
		<>
			<HighFreqRow style={{ paddingBottom: 12 }}>
				<PlayerDownloadButton onAction={onAction} />
				{currentTrack?.source === 'bilibili' && (
					<HighFreqButton
						label='评论区'
						icon='comment-text-outline'
						onPress={() =>
							onAction(() =>
								router.push({
									pathname: '/comments/[bvid]',
									params: { bvid: currentTrack.bilibiliMetadata.bvid },
								}),
							)
						}
					/>
				)}
			</HighFreqRow>
			<PlayerModeSwitch onAction={onAction} />
			<PodcastPlaybackSettings />
			<Divider />
			<SharedTrackActions onAction={onAction} />
			<ShareSongAction onAction={onAction} />
		</>
	)
}

const report = (error: unknown) =>
	toastAndLogError('更新播放设置失败', error, 'Player.Mode')

function PodcastPlaybackSettings() {
	const { shuffle, repeat } = usePlaybackOptions()
	const { colors } = useTheme()
	return (
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
	)
}
