import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useRef, useState, useSyncExternalStore } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { toastAndLogError } from '@/utils/error-handling'
import {
	getStartupScreen,
	setStartupScreen as persistStartupScreen,
	subscribeStartupScreen,
} from '@/utils/startup-screen'
import toast from '@/utils/toast'

function setStartupScreen(screen: 'home' | 'library') {
	persistStartupScreen(screen)
}

export default function GeneralSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)

	const setEnableDataCollection = useAppStore(
		(state) => state.setEnableDataCollection,
	)
	const enableDataCollection = useAppStore(
		(state) => state.settings.enableDataCollection,
	)

	const setEnableDebugLog = useAppStore((state) => state.setEnableDebugLog)
	const enableDebugLog = useAppStore((state) => state.settings.enableDebugLog)
	const expandMultiPageOnSync = useAppStore(
		(state) => state.settings.expandMultiPageOnSync,
	)

	const startupScreen = useSyncExternalStore(
		subscribeStartupScreen,
		getStartupScreen,
	)

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

	const [isSharing, setIsSharing] = useState(false)
	const isSharingRef = useRef(false)

	const shareLogFile = () => {
		if (isSharingRef.current) return
		isSharingRef.current = true
		setIsSharing(true)
		void performShareLog(setIsSharing, isSharingRef)
	}

	const menuActions = useMenuActions([
		{
			title: '主页',
			state: startupScreen === 'home' ? 'on' : 'off',
			onPress: () => setStartupScreen('home'),
		},
		{
			title: '音乐库',
			state: startupScreen === 'library' ? 'on' : 'off',
			onPress: () => setStartupScreen('library'),
		},
	])

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
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title='启动'
					first
				/>
				<View style={styles.settingRow}>
					<Text>启动时进入</Text>
					<MenuView {...menuActions}>
						<IconButton
							icon='chevron-down'
							size={20}
						/>
					</MenuView>
				</View>

				<SettingsSectionTitle title='隐私与数据' />
				<View style={styles.settingRow}>
					<Text>分享数据（崩溃报告 & 匿名统计）</Text>
					<UniversalSwitch
						value={enableDataCollection}
						onValueChange={setEnableDataCollection}
					/>
				</View>

				<SettingsSectionTitle title='歌单同步' />
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>同步时展开分 P 视频</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							同步 Bilibili 收藏夹 / 合集时，把分 P 视频展开为独立曲目
						</Text>
					</View>
					<UniversalSwitch
						value={expandMultiPageOnSync ?? false}
						onValueChange={(value) =>
							// 使用 setSettings 方法会跳转到「2025-08-05 播放」的页面？but why？只能先使用 setState
							useAppStore.setState((state) => {
								state.settings.expandMultiPageOnSync = value
								return state
							})
						}
					/>
				</View>

				<SettingsSectionTitle title='更新与维护' />
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
					<Text>分享今日运行日志</Text>
					<IconButton
						icon='share-variant'
						size={20}
						onPress={shareLogFile}
						loading={isSharing}
						disabled={isSharing}
					/>
				</View>

				<SettingsSectionTitle title='开发者' />
				<View style={styles.settingRow}>
					<Text>打开{'\u2009Debug\u2009'}日志</Text>
					<UniversalSwitch
						value={enableDebugLog}
						onValueChange={setEnableDebugLog}
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
				<View style={styles.settingRow}>
					<Text>性能</Text>
					<IconButton
						icon='speedometer'
						size={20}
						onPress={() => router.push('/performance')}
					/>
				</View>
			</ScrollView>
		</View>
	)
}

async function performShareLog(
	setIsSharing: (v: boolean) => void,
	isSharingRef: { current: boolean },
) {
	try {
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
	} catch (e) {
		toastAndLogError('', e, 'UI.Settings')
	} finally {
		setIsSharing(false)
		isSharingRef.current = false
	}
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
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
})
