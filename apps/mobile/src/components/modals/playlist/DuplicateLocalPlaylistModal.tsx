import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useDuplicatePlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'

export default function DuplicateLocalPlaylistModal({
	sourcePlaylistId,
	rawName,
}: {
	sourcePlaylistId: number
	rawName: string
}) {
	const [duplicatePlaylistName, setDuplicatePlaylistName] = useState(
		`${rawName}-副本`,
	)
	const duplicatePlaylistNameState = useTextFieldState(duplicatePlaylistName)
	const { mutate: duplicatePlaylist } = useDuplicatePlaylist()
	const close = useModalStore((state) => state.close)
	const closeAll = useModalStore((state) => state.closeAll)
	const router = useRouter()

	const handleDuplicatePlaylist = useCallback(() => {
		if (!duplicatePlaylistName) return
		duplicatePlaylist(
			{
				playlistId: Number(sourcePlaylistId),
				name: duplicatePlaylistName,
			},
			{
				onSuccess: (id) => {
					closeAll()
					useModalStore.getState().doAfterModalHostClosed(() => {
						router.push({
							pathname: '/playlist/local/[id]',
							params: { id: String(id) },
						})
					})
				},
			},
		)
	}, [
		duplicatePlaylistName,
		duplicatePlaylist,
		sourcePlaylistId,
		closeAll,
		router,
	])

	return (
		<>
			<Dialog.Title>复制播放列表</Dialog.Title>
			<Dialog.Content>
				<Host
					matchContents={{ vertical: true }}
					style={styles.textInput}
				>
					<OutlinedTextField
						value={duplicatePlaylistNameState}
						onValueChange={setDuplicatePlaylistName}
						singleLine
						modifiers={[fillMaxWidth()]}
					>
						<OutlinedTextField.Label>
							<ComposeText>新播放列表名称</ComposeText>
						</OutlinedTextField.Label>
					</OutlinedTextField>
				</Host>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('DuplicateLocalPlaylist')}>取消</Button>
				<Button onPress={handleDuplicatePlaylist}>确定</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	textInput: {
		maxHeight: 200,
	},
})
