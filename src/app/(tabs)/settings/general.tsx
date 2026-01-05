import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, IconButton, Switch, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function GeneralSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)
	const setSettings = useAppStore((state) => state.setSettings)

	const sendPlayHistory = useAppStore((state) => state.settings.sendPlayHistory)
	const setEnableSentryReport = useAppStore(
		(state) => state.setEnableSentryReport,
	)
	const enableSentryReport = useAppStore(
		(state) => state.settings.enableSentryReport,
	)
	const setEnableDebugLog = useAppStore((state) => state.setEnableDebugLog)
	const enableDebugLog = useAppStore((state) => state.settings.enableDebugLog)

	const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false)

	const handleCheckForUpdate = async () => {
		setIsCheckingForUpdate(true)
		try {
			const result = await checkForAppUpdate()
			if (result.isErr()) {
				toast.error('检查更新失败', { description: result.error.message })
				setIsCheckingForUpdate(false)
				return
			}

			const { update } = result.value
			if (update) {
				if (update.forced) {
					openModal('UpdateApp', update, { dismissible: false })
				} else {
					openModal('UpdateApp', update)
				}
			} else {
				toast.success('已是最新版本')
			}
		} catch (e) {
			toast.error('检查更新时发生未知错误', { description: String(e) })
		}
		setIsCheckingForUpdate(false)
	}

	const shareLogFile = async () => {
		const d = new Date()
		const dateString = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
		const file = new FileSystem.File(
			FileSystem.Paths.document,
			'logs',
			`${dateString}.log`,
		)
		if (file.exists) {
			await Sharing.shareAsync(file.uri)
		} else {
			toastAndLogError('', new Error('无法分享日志：未找到日志文件'), 'UI.Test')
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='通用设置' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + 20 },
				]}
			>
				<View style={styles.settingRow}>
					<Text>向{'\u2009Bilibili\u2009'}上报观看进度</Text>
					<Switch
						value={sendPlayHistory}
						onValueChange={() =>
							setSettings({ sendPlayHistory: !sendPlayHistory })
						}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>向{'\u2009Sentry\u2009'}上报错误</Text>
					<Switch
						value={enableSentryReport}
						onValueChange={setEnableSentryReport}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>打开{'\u2009Debug\u2009'}日志</Text>
					<Switch
						value={enableDebugLog}
						onValueChange={setEnableDebugLog}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>手动设置{'\u2009Cookie'}</Text>
					<IconButton
						icon='open-in-new'
						size={20}
						onPress={() => openModal('CookieLogin', undefined)}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>重新扫码登录</Text>
					<IconButton
						icon='open-in-new'
						size={20}
						onPress={() => openModal('QRCodeLogin', undefined)}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>分享今日运行日志</Text>
					<IconButton
						icon='share-variant'
						size={20}
						onPress={shareLogFile}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>检查更新</Text>
					<IconButton
						icon='update'
						size={20}
						loading={isCheckingForUpdate}
						onPress={handleCheckForUpdate}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>开发者页面</Text>
					<IconButton
						icon='open-in-new'
						size={20}
						onPress={() => router.push('/test')}
					/>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 25,
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
})
