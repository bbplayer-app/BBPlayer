import Icon from '@react-native-vector-icons/material-design-icons'
import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useEnableSharing } from '@/hooks/mutations/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

const SHARE_BASE_URL = 'https://bbplayer.roitium.com/share/playlist'

export default function EnableSharingModal({
	playlistId,
}: {
	playlistId: number
}) {
	const close = useModalStore((state) => state.close)
	const { mutate: enableSharing, isPending } = useEnableSharing()
	const [shareId, setShareId] = useState<string | null>(null)
	const hasToken = useAppStore((state) => !!state.bbplayerToken)

	const shareUrl = shareId ? `${SHARE_BASE_URL}/${shareId}` : ''

	const handleConfirm = () => {
		enableSharing(
			{ playlistId },
			{ onSuccess: ({ shareId: id }) => setShareId(id) },
		)
	}

	const handleCopy = async () => {
		await Clipboard.setStringAsync(shareUrl)
		toast.success('已复制分享链接')
	}

	// ---- 成功状态：显示可复制的链接 ----
	if (shareId) {
		return (
			<>
				<Dialog.Title>共享已开启 🎉</Dialog.Title>
				<Dialog.Content>
					<View style={styles.body}>
						<Text variant='bodyMedium'>
							把下方链接发给朋友，对方即可订阅此歌单。
						</Text>
						<View style={styles.linkRow}>
							<TextInput
								value={shareUrl}
								editable={false}
								mode='outlined'
								dense
								style={styles.linkInput}
								right={
									<TextInput.Icon
										icon='content-copy'
										onPress={handleCopy}
									/>
								}
							/>
						</View>
					</View>
				</Dialog.Content>
				<Dialog.Actions>
					<Button
						onPress={handleCopy}
						mode='text'
					>
						复制链接
					</Button>
					<Button
						onPress={() => close('EnableSharing')}
						mode='text'
					>
						完成
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	// ---- 确认状态 ----
	return (
		<>
			<Dialog.Title>开启歌单共享</Dialog.Title>
			<Dialog.Content>
				<View style={styles.body}>
					{!hasToken && (
						<View style={styles.warningBox}>
							<Icon
								name='alert-circle-outline'
								size={16}
								style={styles.warningIcon}
							/>
							<Text
								variant='bodySmall'
								style={styles.warningText}
							>
								开启共享需要验证身份。点击确认后，你的 Bilibili Cookie
								将被上传至服务器以确认你是真实用户。BBPlayer
								完全开源，你可以随时审计相关代码。
							</Text>
						</View>
					)}
					<Text variant='bodyMedium'>
						共享后，其他用户可通过链接订阅此歌单。
					</Text>
					<Text
						variant='bodySmall'
						style={styles.irreversible}
					>
						⚠️ 目前版本共享后无法撤销共享，请谨慎操作。
					</Text>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('EnableSharing')}
					disabled={isPending}
					mode='text'
				>
					取消
				</Button>
				<Button
					onPress={handleConfirm}
					loading={isPending}
					disabled={isPending}
					mode='text'
				>
					开启共享
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	body: {
		gap: 12,
	},
	linkRow: {
		marginTop: 4,
	},
	linkInput: {
		fontSize: 12,
	},
	warningBox: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 6,
		borderRadius: 8,
		backgroundColor: 'rgba(255, 180, 0, 0.12)',
		padding: 10,
	},
	warningIcon: {
		marginTop: 1,
		color: '#c58c00',
	},
	warningText: {
		flex: 1,
		color: '#c58c00',
		lineHeight: 18,
	},
	irreversible: {
		opacity: 0.6,
	},
})
