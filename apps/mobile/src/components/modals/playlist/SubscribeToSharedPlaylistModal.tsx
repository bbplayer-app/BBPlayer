import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useSubscribeToSharedPlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'

/** 从分享链接或原始 UUID 中提取 UUID */
function extractShareId(input: string): string {
	const trimmed = input.trim()
	// 匹配 UUID 格式（8-4-4-4-12）
	const uuidMatch = trimmed.match(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
	)
	return uuidMatch ? uuidMatch[0] : trimmed
}

export default function SubscribeToSharedPlaylistModal() {
	const [input, setInput] = useState('')
	const [inviteCode, setInviteCode] = useState('')
	const close = useModalStore((state) => state.close)
	const { mutate: subscribe, isPending } = useSubscribeToSharedPlaylist()

	const shareId = extractShareId(input)
	const isValidId =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			shareId,
		)

	const handleSubscribe = () => {
		if (!isValidId) return
		subscribe(
			{ shareId, inviteCode: inviteCode.trim() || undefined },
			{
				onSuccess: () => close('SubscribeToSharedPlaylist'),
			},
		)
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
					onChangeText={setInput}
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
