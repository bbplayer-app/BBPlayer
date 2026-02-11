import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'

export interface UpdateModalProps {
	version: string
	notes: string
	listed_notes?: string[]
	forced?: boolean
	url: string
}

export default function UpdateAppModal({
	version,
	notes,
	listed_notes,
	url,
	forced = false,
}: UpdateModalProps) {
	const colors = useTheme().colors
	const _close = useModalStore((state) => state.close)
	const close = useCallback(() => _close('UpdateApp'), [_close])

	const onUpdate = async () => {
		try {
			if (url) await WebBrowser.openBrowserAsync(url)
		} catch (e) {
			void Clipboard.setStringAsync(url)
			toast.error('无法打开浏览器，已将链接复制到剪贴板', {
				description: String(e),
			})
		}
		close()
	}

	const onSkip = () => {
		storage.set('skip_version', version)
		close()
	}

	const onCancel = () => {
		close()
	}

	return (
		<>
			<Dialog.Title>发现新版本 {version}</Dialog.Title>
			<Dialog.Content>
				{forced ? (
					<Text style={[styles.forcedText, { color: colors.error }]}>
						此更新为强制更新，必须安装后继续使用。
					</Text>
				) : null}
				{listed_notes && listed_notes.length > 0 ? (
					listed_notes.map((note, index) => (
						<Text
							selectable
							key={index}
							style={styles.noteText}
						>
							{`• ${note}`}
						</Text>
					))
				) : (
					<Text selectable>
						{/* 小米对联，偷了！ */}
						{notes?.trim() || '提高软件稳定性，优化软件流畅度'}
					</Text>
				)}
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				{!forced ? <Button onPress={onSkip}>跳过此版本</Button> : <View />}
				<View style={styles.rightActionsContainer}>
					<Button
						onPress={onCancel}
						disabled={forced}
					>
						取消
					</Button>
					<Button onPress={onUpdate}>去更新</Button>
				</View>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	forcedText: {
		marginBottom: 8,
		fontWeight: 'bold',
	},
	noteText: {
		marginBottom: 4,
	},
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
	},
})
