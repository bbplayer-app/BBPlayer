import {
	Column,
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** 从任意输入中提取 shareId + inviteCode（优先 query params） */
function parseShareLink(input: string): {
	shareId?: string
	inviteCode?: string
} {
	const trimmed = input.trim()
	if (!trimmed) return {}

	try {
		const url = new URL(trimmed)
		const qpShareId = url.searchParams.get('shareId') ?? undefined
		const qpInvite = url.searchParams.get('inviteCode') ?? undefined
		const pathUuid = url.pathname.match(UUID_RE)?.[0]
		return {
			shareId: qpShareId ?? pathUuid ?? undefined,
			inviteCode: qpInvite ?? undefined,
		}
	} catch (_e) {
		// fallback to plain text / raw UUID
		const uuid = trimmed.match(UUID_RE)?.[0]
		return { shareId: uuid ?? undefined, inviteCode: undefined }
	}
}

export default function SubscribeToSharedPlaylistModal() {
	const [input, setInput] = useState('')
	const [inviteCode, setInviteCode] = useState('')
	const inputState = useTextFieldState(input)
	const inviteCodeState = useTextFieldState(inviteCode)
	const close = useModalStore((state) => state.close)
	const router = useRouter()

	const parsed = parseShareLink(input)
	const shareId = parsed.shareId ?? ''
	const isValidId = UUID_RE.test(shareId)

	const handleSubscribe = () => {
		if (!isValidId) return
		close('SubscribeToSharedPlaylist')
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.push({
				pathname: '/share/playlist',
				params: {
					shareId: shareId,
					inviteCode:
						(inviteCode || parsed.inviteCode || '').trim() || undefined,
				},
			})
		})
	}

	const handleChangeInput = (text: string) => {
		setInput(text)
		const next = parseShareLink(text)
		if (next.inviteCode) {
			setInviteCode(next.inviteCode)
		}
	}

	return (
		<>
			<Dialog.Title>订阅共享歌单</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<Text
					variant='bodyMedium'
					style={styles.hint}
				>
					粘贴对方分享的链接或歌单 ID（UUID 格式）即可订阅。
				</Text>
				<Host
					matchContents={{ vertical: true }}
					style={styles.formHost}
				>
					<Column
						modifiers={[fillMaxWidth()]}
						verticalArrangement={{ spacedBy: 8 }}
					>
						<OutlinedTextField
							value={inputState}
							onValueChange={handleChangeInput}
							singleLine
							isError={input.trim().length > 0 && !isValidId}
							keyboardOptions={{
								capitalization: 'none',
								autoCorrectEnabled: false,
							}}
							modifiers={[fillMaxWidth()]}
						>
							<OutlinedTextField.Label>
								<ComposeText>分享链接 / 歌单 ID</ComposeText>
							</OutlinedTextField.Label>
						</OutlinedTextField>
						<OutlinedTextField
							value={inviteCodeState}
							onValueChange={setInviteCode}
							singleLine
							keyboardOptions={{
								capitalization: 'characters',
								autoCorrectEnabled: false,
							}}
							modifiers={[fillMaxWidth()]}
						>
							<OutlinedTextField.Label>
								<ComposeText>编辑者邀请码（可选）</ComposeText>
							</OutlinedTextField.Label>
							{parsed.inviteCode ? (
								<OutlinedTextField.SupportingText>
									<ComposeText>已从链接填充：{parsed.inviteCode}</ComposeText>
								</OutlinedTextField.SupportingText>
							) : null}
						</OutlinedTextField>
					</Column>
				</Host>
				{input.trim().length > 0 && !isValidId && (
					<Text
						variant='bodySmall'
						style={styles.errorText}
					>
						未能识别有效的歌单 ID，请检查链接是否完整。
					</Text>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('SubscribeToSharedPlaylist')}
					mode='text'
				>
					取消
				</Button>
				<Button
					onPress={handleSubscribe}
					disabled={!isValidId}
					mode='text'
				>
					订阅
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 8,
	},
	hint: {
		opacity: 0.7,
		marginBottom: 4,
	},
	formHost: {
		width: '100%',
		marginTop: 4,
	},
	errorText: {
		color: '#cf6679',
		marginTop: 2,
	},
})
