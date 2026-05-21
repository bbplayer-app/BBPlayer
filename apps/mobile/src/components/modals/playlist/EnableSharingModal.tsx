import {
	Host,
	Icon,
	IconButton,
	OutlinedTextField,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import WarningIcon from '@react-native-vector-icons/material-design-icons'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import {
	useEnableSharing,
	useRotateEditorInviteCode,
} from '@/hooks/mutations/db/playlist'
import { useEditorInviteCode } from '@/hooks/queries/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import toast from '@/utils/toast'

const SHARE_BASE_URL = 'https://bbplayer.roitium.com/share/playlist'
const copyIcon = require('@expo/material-symbols/content_copy.xml')

export default function EnableSharingModal({
	playlistId,
	shareId: initialShareId,
	shareRole,
}: {
	playlistId: number
	shareId?: string | null
	shareRole?: 'owner' | 'editor' | 'subscriber' | null
}) {
	const router = useRouter()
	const close = useModalStore((state) => state.close)
	const doAfterModalHostClosed = useModalStore(
		(state) => state.doAfterModalHostClosed,
	)
	const { mutate: enableSharing, isPending } = useEnableSharing()
	const { mutateAsync: rotateInvite, isPending: isRotating } =
		useRotateEditorInviteCode()
	const [shareId, setShareId] = useState<string | null>(initialShareId ?? null)
	const [inviteCode, setInviteCode] = useState<string | null>(null)
	const hasToken = useAppStore((state) => !!state.bbplayerToken)

	const { data: fetchedInviteCode, isFetching: inviteFetching } =
		useEditorInviteCode(shareId)

	const subscribeUrl = shareId
		? `${SHARE_BASE_URL}?shareId=${encodeURIComponent(shareId)}`
		: ''
	const editorUrl = shareId
		? `${subscribeUrl}${inviteCode ? `&inviteCode=${encodeURIComponent(inviteCode)}` : ''}`
		: ''
	const subscribeUrlState = useTextFieldState(subscribeUrl)
	const editorUrlState = useTextFieldState(editorUrl)
	const inviteCodeState = useTextFieldState(inviteCode ?? '')

	useEffect(() => {
		if (fetchedInviteCode) setInviteCode(fetchedInviteCode)
	}, [fetchedInviteCode])

	const handleConfirm = () => {
		if (!hasToken) {
			doAfterModalHostClosed(() => {
				router.push({
					pathname: '/settings/account',
					params: { returnTo: `/playlist/local/${playlistId}` },
				} as never)
			})
			close('EnableSharing')
			return
		}
		enableSharing(
			{ playlistId },
			{ onSuccess: ({ shareId: id }) => setShareId(id) },
		)
	}

	const handleCopySubscribe = async () => {
		if (!subscribeUrl) return
		await Clipboard.setStringAsync(subscribeUrl)
		toast.success('已复制订阅链接')
	}

	const handleCopyEditorLink = async () => {
		if (!editorUrl || !inviteCode) return
		await Clipboard.setStringAsync(editorUrl)
		toast.success('已复制协作编辑链接')
	}

	const handleRotateInvite = async () => {
		if (!shareId) return
		if (!hasToken) {
			toast.error('请先登录 BBPlayer 账号')
			doAfterModalHostClosed(() => {
				router.push({
					pathname: '/settings/account',
					params: { returnTo: `/playlist/local/${playlistId}` },
				} as never)
			})
			close('EnableSharing')
			return
		}
		const result = await rotateInvite({ shareId })
		setInviteCode(result.editorInviteCode)
		toast.success('已生成新的编辑者邀请码')
	}

	const handleCopyInvite = async () => {
		if (!inviteCode) return
		await Clipboard.setStringAsync(inviteCode)
		toast.success('已复制邀请码')
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
						<View style={styles.linkSection}>
							<Text variant='bodySmall'>订阅链接（只读）</Text>
							<Host
								matchContents={{ vertical: true }}
								style={styles.linkHost}
							>
								<OutlinedTextField
									value={subscribeUrlState}
									readOnly
									singleLine
									textStyle={styles.linkText}
									modifiers={[fillMaxWidth()]}
								>
									<OutlinedTextField.TrailingIcon>
										<IconButton onClick={handleCopySubscribe}>
											<Icon
												source={copyIcon}
												size={20}
												contentDescription='复制订阅链接'
											/>
										</IconButton>
									</OutlinedTextField.TrailingIcon>
								</OutlinedTextField>
							</Host>
						</View>
						{(!shareRole || shareRole === 'owner') && (
							<View style={styles.inviteSection}>
								<Text variant='bodyMedium'>
									需要协作者编辑此歌单？使用下面的邀请链接。
								</Text>
								{inviteCode && (
									<View style={styles.linkSection}>
										<Text variant='bodySmall'>协作编辑邀请链接</Text>
										<Host
											matchContents={{ vertical: true }}
											style={styles.linkHost}
										>
											<OutlinedTextField
												value={editorUrlState}
												readOnly
												singleLine
												textStyle={styles.linkText}
												modifiers={[fillMaxWidth()]}
											>
												<OutlinedTextField.TrailingIcon>
													<IconButton onClick={handleCopyEditorLink}>
														<Icon
															source={copyIcon}
															size={20}
															contentDescription='复制协作编辑邀请链接'
														/>
													</IconButton>
												</OutlinedTextField.TrailingIcon>
											</OutlinedTextField>
										</Host>
									</View>
								)}
								{!inviteCode && inviteFetching && (
									<Text
										variant='bodySmall'
										style={{ textAlign: 'center' }}
									>
										邀请码加载中...
									</Text>
								)}
								<Button
									onPress={handleRotateInvite}
									loading={isRotating}
									disabled={isRotating || inviteFetching}
								>
									{inviteCode ? '重置协作编辑邀请链接' : '生成协作编辑邀请链接'}
								</Button>
							</View>
						)}
					</View>
				</Dialog.Content>
				<Dialog.Actions>
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
							<WarningIcon
								name='alert-circle-outline'
								size={16}
								style={styles.warningIcon}
							/>
							<Text
								variant='bodySmall'
								style={styles.warningText}
							>
								开启共享需要先登录 BBPlayer 账号。
							</Text>
						</View>
					)}
					{inviteCode && (
						<View style={styles.linkSection}>
							<Text variant='bodySmall'>邀请码</Text>
							<Host
								matchContents={{ vertical: true }}
								style={styles.linkHost}
							>
								<OutlinedTextField
									value={inviteCodeState}
									readOnly
									singleLine
									textStyle={styles.linkText}
									modifiers={[fillMaxWidth()]}
								>
									<OutlinedTextField.TrailingIcon>
										<IconButton onClick={handleCopyInvite}>
											<Icon
												source={copyIcon}
												size={20}
												contentDescription='复制邀请码'
											/>
										</IconButton>
									</OutlinedTextField.TrailingIcon>
								</OutlinedTextField>
							</Host>
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
	linkSection: {
		marginTop: 4,
		gap: 4,
	},
	linkHost: {
		width: '100%',
	},
	linkText: {
		fontSize: 12,
	},
	inviteSection: {
		marginTop: 8,
		gap: 8,
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
