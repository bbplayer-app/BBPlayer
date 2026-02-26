import { useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useSubscribeToSharedPlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'

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
	const close = useModalStore((state) => state.close)
	const { mutate: subscribe, isPending } = useSubscribeToSharedPlaylist()

	const parsed = useMemo(() => parseShareLink(input), [input])
	const shareId = parsed.shareId ?? ''
	const isValidId = UUID_RE.test(shareId)

	const handleSubscribe = () => {
		if (!isValidId) return
		subscribe(
			{
				shareId,
				inviteCode: (inviteCode || parsed.inviteCode || '').trim() || undefined,
			},
			{
				onSuccess: () => close('SubscribeToSharedPlaylist'),
			},
		)
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
				<TextInput
					label='分享链接 / 歌单 ID'
					value={input}
					onChangeText={handleChangeInput}
					mode='outlined'
					autoCapitalize='none'
					autoCorrect={false}
					style={styles.input}
					editable={!isPending}
					error={input.trim().length > 0 && !isValidId}
				/>
				<TextInput
					label='编辑者邀请码（可选）'
					value={inviteCode}
					onChangeText={setInviteCode}
					mode='outlined'
					autoCapitalize='characters'
					autoCorrect={false}
					style={styles.input}
					editable={!isPending}
					placeholder={
						parsed.inviteCode ? `已从链接填充：${parsed.inviteCode}` : ''
					}
				/>
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
					disabled={isPending}
					mode='text'
				>
					取消
				</Button>
				<Button
					onPress={handleSubscribe}
					loading={isPending}
					disabled={isPending || !isValidId}
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
	input: {
		marginTop: 4,
	},
	errorText: {
		color: '#cf6679',
		marginTop: 2,
	},
})
