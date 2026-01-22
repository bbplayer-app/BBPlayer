import { playlistKeys } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import { playlistFacade } from '@/lib/facades/playlist'
import type { ModalPropsMap } from '@/types/navigation'
import { toastAndLogError } from '@/utils/error-handling'
import Log from '@/utils/log'
import toast from '@/utils/toast'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Button, Dialog, TextInput } from 'react-native-paper'

const logger = Log.extend('SaveQueueToPlaylistModal')

export default function SaveQueueToPlaylistModal({
	trackIds,
}: ModalPropsMap['SaveQueueToPlaylist']) {
	const [name, setName] = useState('')
	const [loading, setLoading] = useState(false)
	const close = useModalStore((state) => state.close)

	const handleSave = async () => {
		if (!name.trim()) return
		setLoading(true)

		const res = await playlistFacade.saveQueueAsPlaylist(name, trackIds)

		if (res.isErr()) {
			toastAndLogError(
				'保存播放列表失败',
				res.error,
				'SaveQueueToPlaylistModal',
			)
			setLoading(false)
			return
		}

		logger.info('保存队列到播放列表成功', res.value)
		toast.success('保存队列到播放列表成功')
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			}),
			queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistContents(res.value),
			}),
			queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistMetadata(res.value),
			}),
		])
		setLoading(false)
		close('SaveQueueToPlaylist')
	}

	return (
		<>
			<Dialog.Title>保存队列到播放列表</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label='播放列表名称'
					value={name}
					onChangeText={setName}
					mode='outlined'
					style={styles.textInput}
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('SaveQueueToPlaylist')}
					disabled={loading}
				>
					取消
				</Button>
				<Button
					onPress={handleSave}
					loading={loading}
					disabled={loading}
				>
					保存
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	textInput: {
		backgroundColor: 'transparent',
	},
})
