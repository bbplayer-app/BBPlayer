import {
	Column,
	Host,
	Icon,
	IconButton,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useEditPlaylistMetadata } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import { bilibiliFacade } from '@/lib/facades/bilibili'
import type { Playlist } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import toast from '@/utils/toast'

const logger = log.extend('Components.EditPlaylistMetadataModal')
const imagePlusIcon = require('@expo/material-symbols/add_photo_alternate.xml')

export default function EditPlaylistMetadataModal({
	playlist,
}: {
	playlist: Playlist
}) {
	const { mutate: editPlaylistMetadata } = useEditPlaylistMetadata()
	const [title, setTitle] = useState(playlist.title)
	const [description, setDescription] = useState(playlist.description)
	const [coverUrl, setCoverUrl] = useState(playlist.coverUrl)
	const titleState = useTextFieldState(title)
	const descriptionState = useTextFieldState(description ?? '')
	const coverUrlState = useTextFieldState(coverUrl ?? '')
	const _close = useModalStore((state) => state.close)
	const close = useCallback(() => _close('EditPlaylistMetadata'), [_close])

	const fetchRemoteMetadata = useCallback(async () => {
		if (!playlist.remoteSyncId) {
			toast.error('播放列表的 remoteSyncId 为空，无法获取远程数据')
			return
		}
		const result = await bilibiliFacade.fetchRemotePlaylistMetadata(
			playlist.remoteSyncId,
			playlist.type,
		)
		if (result.isErr()) {
			toastAndLogError(
				'获取远程播放列表元数据失败',
				result.error,
				'Components.EditPlaylistMetadataModal',
			)
			return
		}
		const metadata = result.value
		setTitle(metadata.title)
		setDescription(metadata.description)
		setCoverUrl(metadata.coverUrl)
		logger.debug('获取远程播放列表元数据成功', metadata)
		toast.success('获取远程播放列表元数据成功')
	}, [playlist.remoteSyncId, playlist.type])

	const handleConfirm = useCallback(() => {
		if (title.trim().length === 0) {
			toast.error('标题不能为空')
			return
		}
		editPlaylistMetadata({
			playlistId: playlist.id,
			payload: {
				title,
				description: description ?? undefined,
				coverUrl: coverUrl ?? undefined,
			},
		})
		close()
	}, [close, coverUrl, description, editPlaylistMetadata, playlist.id, title])

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
			coverDir.create({ intermediates: true })
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
			<Dialog.Title>编辑信息</Dialog.Title>
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
							modifiers={[fillMaxWidth()]}
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
			<Dialog.Actions style={styles.actionsContainer}>
				{playlist.type !== 'local' && playlist.type !== 'dynamic' ? (
					<Button onPress={fetchRemoteMetadata}>获取远程数据</Button>
				) : (
					<View />
				)}
				<View style={styles.rightActionsContainer}>
					<Button onPress={handleDismiss}>取消</Button>
					<Button onPress={handleConfirm}>确定</Button>
				</View>
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
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
})
