import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Button, Dialog, List, TextInput } from 'react-native-paper'

import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { LyricFileData } from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export default function EditLyricsModal({
	uniqueKey,
	lyrics,
}: {
	uniqueKey: string
	lyrics: LyricFileData
}) {
	const close = useModalStore((state) => state.close)

	const [lrc, setLrc] = useState(lyrics.lrc ?? '')
	const [tlyric, setTlyric] = useState(lyrics.tlyric ?? '')
	const [romalrc, setRomalrc] = useState(lyrics.romalrc ?? '')

	const handleConfirm = async () => {
		const newLyricData: LyricFileData = {
			...lyrics,
			lrc,
			tlyric: tlyric || undefined,
			romalrc: romalrc || undefined,
			updateTime: Date.now(),
		}

		console.warn('saving', newLyricData)

		const result = await lyricService.saveLyricsToFile(newLyricData, uniqueKey)

		if (result.isErr()) {
			toastAndLogError(
				'保存歌词失败',
				result.error,
				'Components.EditLyricsModal',
			)
			return
		}

		queryClient.setQueryData(
			lyricsQueryKeys.smartFetchLyrics(uniqueKey),
			result.value,
		)
		toast.success('歌词保存成功')
		close('EditLyrics')
	}

	return (
		<>
			<Dialog.Title>编辑歌词</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<ScrollView style={styles.scrollView}>
					<List.AccordionGroup>
						<List.Accordion
							title='主歌词'
							id='lrc'
							left={(props) => (
								<List.Icon
									{...props}
									icon='music-note'
								/>
							)}
						>
							<View style={styles.inputContainer}>
								<TextInput
									value={lrc}
									onChangeText={setLrc}
									mode='outlined'
									multiline
									style={styles.textInput}
									textAlignVertical='top'
									placeholder='在此输入LRC格式歌词'
								/>
							</View>
						</List.Accordion>

						<List.Accordion
							title='翻译歌词'
							id='tlyric'
							left={(props) => (
								<List.Icon
									{...props}
									icon='translate'
								/>
							)}
						>
							<View style={styles.inputContainer}>
								<TextInput
									value={tlyric}
									onChangeText={setTlyric}
									mode='outlined'
									multiline
									style={styles.textInput}
									textAlignVertical='top'
									placeholder='在此输入翻译歌词'
								/>
							</View>
						</List.Accordion>

						<List.Accordion
							title='罗马音歌词'
							id='romalrc'
							left={(props) => (
								<List.Icon
									{...props}
									icon='alphabetical'
								/>
							)}
						>
							<View style={styles.inputContainer}>
								<TextInput
									value={romalrc}
									onChangeText={setRomalrc}
									mode='outlined'
									multiline
									style={styles.textInput}
									textAlignVertical='top'
									placeholder='在此输入罗马音歌词'
								/>
							</View>
						</List.Accordion>
					</List.AccordionGroup>
				</ScrollView>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('EditLyrics')}>取消</Button>
				<Button onPress={handleConfirm}>确定</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 0,
		paddingBottom: 0,
		maxHeight: 500,
	},
	scrollView: {
		paddingHorizontal: 24,
	},
	inputContainer: {
		paddingVertical: 8,
	},
	textInput: {
		minHeight: 200,
		maxHeight: 400,
		fontSize: 14,
	},
})
