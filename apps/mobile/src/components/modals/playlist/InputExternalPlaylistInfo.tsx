import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Button,
	Dialog,
	SegmentedButtons,
	Text,
	TextInput,
} from 'react-native-paper'

import { useModalStore } from '@/hooks/stores/useModalStore'
import { parseExternalPlaylistInfo } from '@/lib/utils/playlistUrlParser'

const InputExternalPlaylistInfoModal = () => {
	const [input, setInput] = useState('')
	const [source, setSource] = useState<'netease' | 'qq'>('netease')
	const router = useRouter()
	const close = useModalStore((state) => state.close)

	const handleConfirm = () => {
		if (!input.trim()) return
		const parsed = parseExternalPlaylistInfo(input)
		const finalId = parsed?.id ?? input.trim()
		const finalSource = parsed?.source ?? source

		close('InputExternalPlaylistInfo')
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.push({
				pathname: '/playlist/external-sync',
				params: { id: finalId, source: finalSource },
			})
		})
	}

	return (
		<>
			<Dialog.Title>输入外部歌单信息</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label='歌单 ID / 链接'
					value={input}
					onChangeText={(text) => {
						setInput(text)
						const result = parseExternalPlaylistInfo(text)
						if (result) {
							setSource(result.source)
						}
					}}
					mode='outlined'
					style={styles.input}
				/>
				<View style={styles.segmentedContainer}>
					<Text style={styles.label}>来源：</Text>
					<SegmentedButtons
						value={source}
						onValueChange={(value) => setSource(value)}
						buttons={[
							{
								value: 'netease',
								label: '网易云音乐',
							},
							{
								value: 'qq',
								label: 'QQ音乐',
							},
						]}
						style={styles.segmentedButtons}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('InputExternalPlaylistInfo')}>取消</Button>
				<Button
					onPress={handleConfirm}
					disabled={!input.trim()}
				>
					确定
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	input: {
		marginBottom: 16,
	},
	segmentedContainer: {
		marginTop: 8,
	},
	label: {
		marginBottom: 8,
	},
	segmentedButtons: {
		marginTop: 4,
	},
})

export default InputExternalPlaylistInfoModal
