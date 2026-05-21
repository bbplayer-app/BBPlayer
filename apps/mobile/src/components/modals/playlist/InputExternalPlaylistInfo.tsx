import { SegmentedControl } from '@expo/ui/community/segmented-control'
import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import { parseExternalPlaylistInfo } from '@/lib/utils/playlistUrlParser'

const InputExternalPlaylistInfoModal = () => {
	const [input, setInput] = useState('')
	const inputState = useTextFieldState(input)
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
				<Host
					matchContents={{ vertical: true }}
					style={styles.input}
				>
					<OutlinedTextField
						value={inputState}
						onValueChange={(text) => {
							setInput(text)
							const result = parseExternalPlaylistInfo(text)
							if (result) {
								setSource(result.source)
							}
						}}
						singleLine
						modifiers={[fillMaxWidth()]}
					>
						<OutlinedTextField.Label>
							<ComposeText>歌单 ID / 链接</ComposeText>
						</OutlinedTextField.Label>
					</OutlinedTextField>
				</Host>
				<View style={styles.segmentedContainer}>
					<Text style={styles.label}>来源：</Text>
					<SegmentedControl
						selectedIndex={source === 'netease' ? 0 : 1}
						onChange={(event) => {
							const selectedIndex = event.nativeEvent.selectedSegmentIndex
							setSource(selectedIndex === 0 ? 'netease' : 'qq')
						}}
						values={['网易云音乐', 'QQ音乐']}
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
