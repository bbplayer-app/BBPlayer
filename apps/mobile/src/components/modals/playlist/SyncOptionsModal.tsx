import { memo, useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import UniversalCheckbox from '@/components/common/UniversalCheckbox'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'

const SyncOptionsModal = memo(function SyncOptionsModal({
	favoriteId,
	shouldRedirectToLocalPlaylist,
}: {
	favoriteId: number
	shouldRedirectToLocalPlaylist?: boolean
}) {
	const colors = useTheme().colors
	const close = useModalStore((state) => state.close)
	const open = useModalStore((state) => state.open)
	const setSettings = useAppStore((state) => state.setSettings)
	const defaultExpandMultiPage = useAppStore(
		(state) => state.settings.expandMultiPageOnSync,
	)
	const [expandMultiPage, setExpandMultiPage] = useState(
		defaultExpandMultiPage ?? false,
	)

	const handleStart = useCallback(() => {
		setSettings({ expandMultiPageOnSync: expandMultiPage })
		close('SyncOptions')
		open(
			'FavoriteSyncProgress',
			{
				favoriteId,
				shouldRedirectToLocalPlaylist,
				expandMultiPage,
			},
			{ dismissible: false },
		)
	}, [
		close,
		expandMultiPage,
		favoriteId,
		open,
		setSettings,
		shouldRedirectToLocalPlaylist,
	])

	return (
		<>
			<Dialog.Title>同步收藏夹</Dialog.Title>
			<Dialog.Content>
				<View style={styles.checkboxRow}>
					<UniversalCheckbox
						status={expandMultiPage ? 'checked' : 'unchecked'}
						onPress={() => setExpandMultiPage((v) => !v)}
					/>
					<Text variant='bodyLarge'>展开分 P 视频</Text>
				</View>
				<Text
					variant='bodySmall'
					style={[styles.hint, { color: colors.onSurfaceVariant }]}
				>
					开启后，分 P 视频的每一 P 将作为独立媒体同步，适合包含大量分 P
					视频的收藏夹。首次开启需要额外请求分 P 信息，同步时间可能变长。此选项
					仅在首次同步时询问，之后可在「通用设置」中修改。
				</Text>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('SyncOptions')}>取消</Button>
				<Button
					mode='contained'
					onPress={handleStart}
				>
					开始同步
				</Button>
			</Dialog.Actions>
		</>
	)
})

SyncOptionsModal.displayName = 'SyncOptionsModal'

const styles = StyleSheet.create({
	checkboxRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	hint: {
		marginTop: 12,
		lineHeight: 18,
	},
})

export default SyncOptionsModal
