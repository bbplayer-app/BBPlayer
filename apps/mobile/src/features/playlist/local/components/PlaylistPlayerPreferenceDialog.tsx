import { Dialog, Portal, RadioButton, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import { useDialogHorizontalMargin } from '@/hooks/ui/useResponsiveLayout'
import { useTracedMutation } from '@/hooks/utils/useTracedQuery'
import { queryClient } from '@/lib/config/queryClient'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'

export function PlaylistPlayerPreferenceDialog({
	playlist,
	visible,
	onDismiss,
}: {
	playlist: Playlist
	visible: boolean
	onDismiss: () => void
}) {
	const defaultMode = useAppStore((state) => state.settings.defaultPlayerMode)
	const dialogMargin = useDialogHorizontalMargin()

	const mutation = useTracedMutation({
		span: { name: 'playlist.update_player_preference' },
		networkMode: 'always',
		mutationFn: async (preference: Playlist['playerPreference'], { span }) => {
			const result = await playlistService
				.withTrace(span)
				.setPlayerPreference(playlist.id, preference)

			if (result.isErr()) throw result.error
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: playlistKeys.all })
			onDismiss()
		},
		onError: (error) =>
			toastAndLogError(
				'保存播放器偏好失败',
				error,
				'Playlist.PlayerPreference',
			),
	})

	return (
		<Portal>
			<Dialog
				visible={visible}
				onDismiss={onDismiss}
				style={{ marginHorizontal: dialogMargin }}
			>
				<Dialog.Title>播放器偏好</Dialog.Title>
				<Dialog.Content>
					<Text variant='bodyMedium'>
						仅影响从此歌单开始的新播放，不会切换当前播放器。
					</Text>
					<RadioButton.Group
						value={playlist.playerPreference}
						onValueChange={(value) => {
							if (
								value === 'inherit' ||
								value === 'music' ||
								value === 'podcast'
							)
								mutation.mutate(value)
						}}
					>
						<RadioButton.Item
							disabled={mutation.isPending}
							label={`跟随全局（${defaultMode === 'podcast' ? '播客' : '音乐'}）`}
							value='inherit'
						/>
						<RadioButton.Item
							disabled={mutation.isPending}
							label='音乐'
							value='music'
						/>
						<RadioButton.Item
							disabled={mutation.isPending}
							label='播客'
							value='podcast'
						/>
					</RadioButton.Group>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss}>取消</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	)
}
