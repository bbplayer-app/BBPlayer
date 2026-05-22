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
import { StyleSheet } from 'react-native'
import { Dialog } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useEditTrackMetadata } from '@/hooks/mutations/db/track'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import type { Track } from '@/types/core/media'
import toast from '@/utils/toast'

const imagePlusIcon = require('@expo/material-symbols/add_photo_alternate.xml')

const sanitizeFileName = (name: string) =>
	name.replaceAll(/[^a-zA-Z0-9._-]/g, '_')

export default function EditTrackMetadataModal({ track }: { track: Track }) {
	const [title, setTitle] = useState<string>(track.title)
	const [coverUrl, setCoverUrl] = useState(track.coverUrl)
	const titleState = useTextFieldState(title)
	const coverUrlState = useTextFieldState(coverUrl ?? '')
	const _close = useModalStore((state) => state.close)
	const close = useCallback(() => _close('EditTrackMetadata'), [_close])

	const { mutate: editTrackMetadata } = useEditTrackMetadata()

	const handleConfirm = () => {
		const normalizedTitle = title.trim()
		if (!normalizedTitle) {
			toast.error('标题不能为空')
			return
		}
		const normalizedCoverUrl = coverUrl?.trim() ? coverUrl.trim() : null
		editTrackMetadata({
			trackId: track.id,
			title: normalizedTitle,
			coverUrl: normalizedCoverUrl,
			source: track.source,
		})
		close()
	}

	const handleImagePicker = useCallback(async () => {
		const result = await DocumentPicker.getDocumentAsync({
			type: 'image/*',
			copyToCacheDirectory: true,
			multiple: false,
		})
		if (result.canceled || result.assets.length === 0) return

		const asset = result.assets[0]
		const assetFile = new FileSystem.File(asset.uri)
		const coverDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'covers',
			'tracks',
		)
		if (!coverDir.exists) {
			coverDir.create({ intermediates: true })
		}

		const fileName = sanitizeFileName(
			`${track.uniqueKey}-${Date.now()}-${assetFile.name}`,
		)
		const coverFile = new FileSystem.File(coverDir, fileName)
		if (coverFile.exists) {
			coverFile.delete()
		}
		await assetFile.copy(coverFile)
		setCoverUrl(coverFile.uri)
	}, [track.uniqueKey])

	const handleDismiss = () => {
		close()
		setTitle('')
		setCoverUrl('')
	}

	return (
		<>
			<Dialog.Title>编辑歌曲信息</Dialog.Title>
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
				<Button onPress={handleConfirm}>确定</Button>
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
