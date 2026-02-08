import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Dialog, IconButton, TextInput } from 'react-native-paper'

import { useCreateNewLocalPlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

export default function CreatePlaylistModal({
	redirectToNewPlaylist,
}: {
	redirectToNewPlaylist?: boolean
}) {
	const { mutate: createNewPlaylist } = useCreateNewLocalPlaylist()
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [coverUrl, setCoverUrl] = useState('')
	const _close = useModalStore((state) => state.close)
	const closeAll = useModalStore((state) => state.closeAll)
	const close = useCallback(() => _close('CreatePlaylist'), [_close])
	const router = useRouter()

	const handleConfirm = useCallback(() => {
		if (title.trim().length === 0) {
			toast.error('标题不能为空')
			return
		}
		createNewPlaylist(
			{
				title,
				description,
				coverUrl,
			},
			{
				onSuccess: (playlist) => {
					if (redirectToNewPlaylist) {
						closeAll()
						useModalStore.getState().doAfterModalHostClosed(() => {
							router.push({
								pathname: '/playlist/local/[id]',
								params: { id: String(playlist.id) },
							})
						})
					} else {
						closeAll()
					}
				},
			},
		)
	}, [
		closeAll,
		coverUrl,
		createNewPlaylist,
		description,
		router,
		redirectToNewPlaylist,
		title,
	])

	const handleImagePicker = useCallback(async () => {
		const result = await DocumentPicker.getDocumentAsync({
			type: 'image/*',
			copyToCacheDirectory: true,
			multiple: false,
		})
		if (result.canceled || result.assets.length === 0) return
		const assetFile = new FileSystem.File(result.assets[0].uri)
		const coverDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'covers',
		)
		if (!coverDir.exists) {
			coverDir.create({ intermediates: true, idempotent: true })
		}
		const coverFile = new FileSystem.File(coverDir, assetFile.name)
		if (coverFile.exists) {
			coverFile.delete()
		}
		assetFile.copy(coverFile)
		setCoverUrl(coverFile.uri)
	}, [])

	const handleDismiss = useCallback(() => {
		close()
		setTitle('')
		setDescription('')
		setCoverUrl('')
	}, [close])

	return (
		<>
			<Dialog.Title>创建播放列表</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<TextInput
					label='标题'
					value={title}
					onChangeText={setTitle}
					mode='outlined'
					numberOfLines={1}
					textAlignVertical='top'
					testID='create-playlist-title-input'
				/>
				<TextInput
					label='描述'
					onChangeText={setDescription}
					value={description ?? undefined}
					mode='outlined'
					multiline
					style={styles.descriptionInput}
					textAlignVertical='top'
				/>
				<View style={styles.coverUrlContainer}>
					<TextInput
						label='封面'
						onChangeText={setCoverUrl}
						value={coverUrl ?? undefined}
						mode='outlined'
						numberOfLines={1}
						textAlignVertical='top'
						style={styles.coverUrlInput}
					/>
					<IconButton
						icon='image-plus'
						size={20}
						style={styles.imagePickerButton}
						onPress={handleImagePicker}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={handleDismiss}>取消</Button>
				<Button
					onPress={handleConfirm}
					testID='create-playlist-confirm-button'
				>
					确定
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 5,
	},
	descriptionInput: {
		maxHeight: 150,
	},
	coverUrlContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	coverUrlInput: {
		flex: 1,
	},
	imagePickerButton: {
		marginTop: 13,
	},
})
