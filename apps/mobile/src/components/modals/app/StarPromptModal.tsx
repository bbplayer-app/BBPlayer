import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

export const GITHUB_REPO_URL = 'https://github.com/bbplayer-app/BBPlayer'

export default function StarPromptModal() {
	const close = useModalStore((state) => state.close)
	const setSettings = useAppStore((state) => state.setSettings)

	const handleClose = () => close('StarPrompt')

	const handleDontShowAgain = () => {
		setSettings({ hideStarPrompt: true })
		close('StarPrompt')
	}

	const handleGoStar = async () => {
		try {
			await WebBrowser.openBrowserAsync(GITHUB_REPO_URL)
		} catch (e) {
			await Clipboard.setStringAsync(GITHUB_REPO_URL)
			toast.error('无法打开浏览器，已将链接复制到剪贴板', {
				description: String(e),
			})
		}
		close('StarPrompt')
	}

	return (
		<>
			<Dialog.Title>喜欢 BBPlayer 吗？</Dialog.Title>
			<Dialog.Content>
				<Text variant='bodyMedium'>
					如果觉得好用的话，欢迎到 GitHub 点一个 Star 支持一下 🥺
				</Text>
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				<Button onPress={handleDontShowAgain}>不再显示</Button>
				<View style={styles.rightActionsContainer}>
					<Button onPress={handleClose}>取消</Button>
					<Button onPress={() => void handleGoStar()}>去 star</Button>
				</View>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
	},
})
