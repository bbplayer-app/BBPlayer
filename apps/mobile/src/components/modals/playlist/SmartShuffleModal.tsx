import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chip, Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { llmSmartShuffleService } from '@/lib/services/llmSmartShuffleService'
import { playlistService } from '@/lib/services/playlistService'
import { toastAndLogError } from '@/utils/error-handling'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

const QUICK_PROMPTS = [
	'多听点中V',
	'最近收藏的歌曲',
	'老收藏回顾',
	'冷门随机',
	'工作学习',
	'夜晚放松',
	'燃一点',
	'治愈一点',
]

export default function SmartShuffleModal({
	playlistId,
}: {
	playlistId: number
}) {
	const close = useModalStore((state) => state.close)
	const defaultPreference = useAppStore(
		(state) => state.settings.llmDefaultPreference,
	)
	const [prompt, setPrompt] = useState(defaultPreference)
	const [isLoading, setIsLoading] = useState(false)

	const handlePlay = async () => {
		setIsLoading(true)
		try {
			const tracksResult = await playlistService.getPlaylistTracks(playlistId)
			if (tracksResult.isErr()) {
				toastAndLogError(
					'获取播放列表内容失败',
					tracksResult.error,
					'SmartShuffle',
				)
				setIsLoading(false)
				return
			}

			const tracks = tracksResult.value.filter((item) =>
				item.source === 'bilibili'
					? (item.bilibiliMetadata?.videoIsValid ?? false)
					: true,
			)
			if (tracks.length === 0) {
				toast.show('没有可播放的歌曲')
				setIsLoading(false)
				return
			}

			const smartQueueResult = await llmSmartShuffleService.createSmartQueue(
				tracks,
				{
					prompt,
					defaultPreference,
				},
			)
			if (smartQueueResult.isErr()) {
				toastAndLogError(
					'智能随机播放失败',
					smartQueueResult.error,
					'SmartShuffle',
				)
				setIsLoading(false)
				return
			}

			await addToQueue({
				tracks: smartQueueResult.value,
				playNow: true,
				clearQueue: true,
				playNext: false,
			})
			toast.success('已按取向生成智能排序队列')
			close('SmartShuffle')
		} catch (error) {
			toastAndLogError('智能随机播放失败', error, 'SmartShuffle')
		}
		setIsLoading(false)
	}

	return (
		<>
			<Dialog.Title>智能随机播放</Dialog.Title>
			<Dialog.Content>
				<Text
					variant='bodySmall'
					style={styles.description}
				>
					描述这次想听什么，或直接点一个快捷取向。系统会让 LLM
					基于整份歌单生成播放队列，失败时回退到本地标签排序。
				</Text>
				<TextInput
					label='这次想听什么？'
					value={prompt}
					onChangeText={setPrompt}
					mode='outlined'
					multiline
					numberOfLines={4}
					textAlignVertical='top'
					style={styles.input}
					placeholder='例如：我想多听点中V，穿插一些最近收藏'
				/>
				<View style={styles.chips}>
					{QUICK_PROMPTS.map((item) => (
						<Chip
							key={item}
							onPress={() => setPrompt(item)}
							style={styles.chip}
						>
							{item}
						</Chip>
					))}
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('SmartShuffle')}
					disabled={isLoading}
				>
					取消
				</Button>
				<Button
					onPress={handlePlay}
					disabled={isLoading}
				>
					开始播放
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	description: {
		marginBottom: 12,
		opacity: 0.75,
	},
	input: {
		maxHeight: 140,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 12,
	},
	chip: {
		marginRight: 8,
		marginBottom: 8,
	},
})
