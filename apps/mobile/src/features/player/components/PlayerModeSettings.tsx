import { RepeatMode } from '@bbplayer/orpheus'
import { View } from 'react-native'
import { List, RadioButton, Text } from 'react-native-paper'

import {
	usePlaybackOptions,
	setPlayerRepeatMode,
	setPlayerShuffleMode,
} from '@/hooks/player/usePlaybackOptions'
import { usePlaybackContextStore } from '@/hooks/stores/usePlaybackContextStore'
import { switchPlayerMode } from '@/lib/player/playbackSession'
import { toastAndLogError } from '@/utils/error-handling'

const report = (error: unknown) =>
	toastAndLogError('更新播放设置失败', error, 'Player.Mode')

export function PlayerModeSettings() {
	const context = usePlaybackContextStore((state) => state.context)
	const { shuffle, repeat } = usePlaybackOptions()
	return (
		<View>
			<List.Subheader>当前播放器</List.Subheader>
			<Text
				variant='bodySmall'
				style={{ paddingHorizontal: 16 }}
			>
				仅影响当前播放，不修改全局或歌单偏好。
			</Text>
			<RadioButton.Group
				value={context?.mode ?? 'music'}
				onValueChange={(mode) => {
					if (mode === 'music' || mode === 'podcast')
						void switchPlayerMode(mode).catch(report)
				}}
			>
				<RadioButton.Item
					label='音乐'
					value='music'
					disabled={!context}
				/>
				<RadioButton.Item
					label='播客'
					value='podcast'
					disabled={!context}
				/>
			</RadioButton.Group>
			{context?.mode === 'podcast' && (
				<>
					<List.Item
						title='随机播放'
						description={shuffle ? '开启' : '关闭'}
						left={(props) => (
							<List.Icon
								{...props}
								icon={shuffle ? 'shuffle-variant' : 'shuffle-disabled'}
							/>
						)}
						onPress={() => {
							void setPlayerShuffleMode(!shuffle).catch(report)
						}}
					/>
					<List.Subheader>循环模式</List.Subheader>
					<RadioButton.Group
						value={String(repeat)}
						onValueChange={(value) => {
							const mode = [
								RepeatMode.OFF,
								RepeatMode.TRACK,
								RepeatMode.QUEUE,
							].find((candidate) => String(candidate) === value)
							if (mode !== undefined)
								void setPlayerRepeatMode(mode).catch(report)
						}}
					>
						<RadioButton.Item
							label='关闭循环'
							value={String(RepeatMode.OFF)}
						/>
						<RadioButton.Item
							label='单曲循环'
							value={String(RepeatMode.TRACK)}
						/>
						<RadioButton.Item
							label='队列循环'
							value={String(RepeatMode.QUEUE)}
						/>
					</RadioButton.Group>
				</>
			)}
		</View>
	)
}
