import { exportBackupToDownloads } from '@bbplayer/native'
import * as Expo from 'expo'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { createBackup } from '@/lib/backup/export'
import { restoreBackup } from '@/lib/backup/import'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export default function GeneralSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)
	const haveTrack = useCurrentTrack()

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

	const [isExporting, setIsExporting] = useState(false)
	const isExportingRef = useRef(false)

	const handleExport = () => {
		if (isExportingRef.current) return
		isExportingRef.current = true
		setIsExporting(true)
		void (async () => {
			try {
				const uri = await createBackup()
				const fileName = `backup-${Date.now()}.zip`

				const downloadsUri = exportBackupToDownloads(
					uri,
					fileName,
					'application/zip',
				)
				if (downloadsUri) {
					toast.success('已导出到下载目录/bbplayer-backup')
				} else {
					toastAndLogError(
						'导出失败',
						new Error('无法写入文件'),
						'UI.Settings.General',
					)
				}
			} catch (e) {
				toastAndLogError('导出失败', e, 'UI.Settings.General')
			} finally {
				setIsExporting(false)
				isExportingRef.current = false
			}
		})()
	}

	const [isImporting, setIsImporting] = useState(false)
	const isImportingRef = useRef(false)

	const handleImport = () => {
		if (isImportingRef.current) return
		isImportingRef.current = true
		setIsImporting(true)
		void (async () => {
			try {
				const result = await DocumentPicker.getDocumentAsync()
				if (result.canceled) return
				const file = result.assets?.[0]
				if (!file) return
				await restoreBackup(file.uri)
				alert(
					'恢复完成',
					'数据已恢复，需要重启应用才能完全生效。是否立即重启？',
					[
						{ text: '稍后' },
						{
							text: '立即重启',
							onPress: () => {
								void Expo.reloadAppAsync()
							},
						},
					],
				)
			} catch (e) {
				toastAndLogError('导入失败', e, 'UI.Settings.General')
			} finally {
				setIsImporting(false)
				isImportingRef.current = false
			}
		})()
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
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<View style={styles.settingRow}>
					<Text>分享数据（崩溃报告 & 匿名统计）</Text>
					<UniversalSwitch
						value={enableDataCollection}
						onValueChange={setEnableDataCollection}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>同步时展开分 P 视频</Text>
					<UniversalSwitch
						value={expandMultiPageOnSync ?? false}
						onValueChange={(v) =>
							// 使用 setSettings 方法会跳转到「2025-08-05 播放」的页面？but why？只能先使用 setState
							useAppStore.setState((state) => {
								state.settings.expandMultiPageOnSync = v
								return state
							})
						}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>打开{'\u2009Debug\u2009'}日志</Text>
					<UniversalSwitch
						value={enableDebugLog}
						onValueChange={setEnableDebugLog}
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
					<Text>下载缺失封面</Text>
					<IconButton
						icon='image-sync'
						size={20}
						onPress={() => openModal('CoverDownloadProgress', undefined)}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>清空图片缓存</Text>
					<IconButton
						icon='image-remove'
						size={20}
						onPress={async () => {
							try {
								await Image.clearDiskCache()
								await Image.clearMemoryCache()
								toast.success('已清空图片缓存')
							} catch (e) {
								toastAndLogError('清空图片缓存失败', e, 'UI.Settings.General')
							}
						}}
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
					<Text>导出数据</Text>
					<IconButton
						icon='export-variant'
						size={20}
						onPress={handleExport}
						loading={isExporting}
						disabled={isExporting}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>导入数据</Text>
					<IconButton
						icon='import'
						size={20}
						onPress={handleImport}
						loading={isImporting}
						disabled={isImporting}
					/>
				</View>
			</ScrollView>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
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
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
