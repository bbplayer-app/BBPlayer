import {
	Column,
	Host,
	Icon,
	IconButton,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useCreateNewLocalPlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import toast from '@/utils/toast'

const imagePlusIcon = require('@expo/material-symbols/add_photo_alternate.xml')

export default function CreatePlaylistModal({
	redirectToNewPlaylist,
}: {
	redirectToNewPlaylist?: boolean
}) {
	const { mutate: createNewPlaylist } = useCreateNewLocalPlaylist()
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [coverUrl, setCoverUrl] = useState('')
	const titleState = useTextFieldState(title)
	const descriptionState = useTextFieldState(description)
	const coverUrlState = useTextFieldState(coverUrl)
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
		await assetFile.copy(coverFile)
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
				<Host
					matchContents={{ vertical: true }}
					style={styles.formHost}
				>
					<Column
						modifiers={[fillMaxWidth()]}
						verticalArrangement={{ spacedBy: 8 }}
					>
						<OutlinedTextField
							value={titleState}
							onValueChange={setTitle}
							singleLine
							modifiers={[
								fillMaxWidth(),
								testID('create-playlist-title-input'),
							]}
						>
							<OutlinedTextField.Label>
								<ComposeText>标题</ComposeText>
							</OutlinedTextField.Label>
						</OutlinedTextField>
						<OutlinedTextField
							value={descriptionState}
							onValueChange={setDescription}
							minLines={3}
							maxLines={3}
							modifiers={[fillMaxWidth()]}
						>
							<OutlinedTextField.Label>
								<ComposeText>描述</ComposeText>
							</OutlinedTextField.Label>
						</OutlinedTextField>
						<OutlinedTextField
							value={coverUrlState}
							onValueChange={setCoverUrl}
							singleLine
							modifiers={[fillMaxWidth()]}
						>
							<OutlinedTextField.Label>
								<ComposeText>封面</ComposeText>
							</OutlinedTextField.Label>
							<OutlinedTextField.TrailingIcon>
								<IconButton onClick={handleImagePicker}>
									<Icon
										source={imagePlusIcon}
										size={20}
										contentDescription='选择封面'
									/>
								</IconButton>
							</OutlinedTextField.TrailingIcon>
						</OutlinedTextField>
					</Column>
				</Host>
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
	formHost: {
		width: '100%',
	},
})
