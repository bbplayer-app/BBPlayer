import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { useEditTrackMetadata } from '@/hooks/mutations/db/track'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { Track } from '@/types/core/media'
import toast from '@/utils/toast'

const sanitizeFileName = (name: string) =>
	name.replaceAll(/[^a-zA-Z0-9._-]/g, '_')

export default function EditTrackMetadataModal({ track }: { track: Track }) {
	const [title, setTitle] = useState<string>(track.title)
	const [coverUrl, setCoverUrl] = useState(track.coverUrl)
	const modalClose = useModalStore((state) => state.close)
	const close = useCallback(() => modalClose('EditTrackMetadata'), [modalClose])

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
				<TextInput
					label='标题'
					value={title}
					onChangeText={setTitle}
					mode='outlined'
					numberOfLines={1}
					textAlignVertical='top'
				/>
				<View style={styles.coverUrlContainer}>
					<TextInput
						label='封面'
						value={coverUrl ?? undefined}
						onChangeText={setCoverUrl}
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
				<Button onPress={handleConfirm}>确定</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 5,
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
