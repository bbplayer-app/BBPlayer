import { useDuplicatePlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Button, Dialog, TextInput } from 'react-native-paper'

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
				<TextInput
					label='新播放列表名称'
					value={duplicatePlaylistName}
					onChangeText={setDuplicatePlaylistName}
					mode='outlined'
					numberOfLines={1}
					style={{ maxHeight: 200 }}
					textAlignVertical='top'
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('DuplicateLocalPlaylist')}>取消</Button>
				<Button onPress={handleDuplicatePlaylist}>确定</Button>
			</Dialog.Actions>
		</>
	)
}
