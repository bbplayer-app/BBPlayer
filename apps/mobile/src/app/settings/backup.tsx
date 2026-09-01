import { exportBackupToDownloads } from '@bbplayer/native'
import * as Expo from 'expo'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Divider,
	List,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import {
	useCloudBackupMutation,
	useCloudRestoreMutation,
	useTestWebDavConnectionMutation,
} from '@/hooks/mutations/backup'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	normalizeWebDavBackupConfig,
	useWebDavBackups,
} from '@/hooks/queries/backup'
import { createBackup } from '@/lib/backup/export'
import { restoreBackup } from '@/lib/backup/import'
import {
	createMobileWebDavClient,
	getWebDavPassword,
	getStoredWebDavConfig,
	saveWebDavConfig,
} from '@/lib/backup/webdav'
import type { WebDavEntry } from '@/lib/backup/webdav-client'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export default function BackupSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const initialConfig = useRef(getStoredWebDavConfig()).current
	const didInitialRefresh = useRef(false)

	const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? '')
	const [username, setUsername] = useState(initialConfig?.username ?? '')
	const [password, setPassword] = useState('')
	const [directory, setDirectory] = useState(
		initialConfig?.directory ?? '/BBPlayer',
	)
	const [isExporting, setIsExporting] = useState(false)
	const [isImporting, setIsImporting] = useState(false)
	const isExportingRef = useRef(false)
	const isImportingRef = useRef(false)
	const isPasswordEditedRef = useRef(false)

	const currentConfig = useCallback(
		() => normalizeWebDavBackupConfig({ baseUrl, username, directory }),
		[baseUrl, directory, username],
	)

	const {
		data: entries,
		isFetching: isRefreshing,
		refetch: refetchBackups,
	} = useWebDavBackups(currentConfig(), password)
	const testConnectionMutation = useTestWebDavConnectionMutation()
	const cloudBackupMutation = useCloudBackupMutation()
	const cloudRestoreMutation = useCloudRestoreMutation(showRestartPrompt)

	useEffect(() => {
		if (!initialConfig || didInitialRefresh.current) return
		didInitialRefresh.current = true
		void refetchBackups({ throwOnError: true }).catch((error) =>
			toastAndLogError('读取云端备份失败', error, 'UI.Settings.Backup'),
		)
	}, [initialConfig, refetchBackups])

	useEffect(() => {
		void getWebDavPassword().then((savedPassword) => {
			if (!isPasswordEditedRef.current) {
				const value = savedPassword ?? ''
				setPassword(value)
			}
		})
	}, [])

	const handleSaveConfig = async () => {
		try {
			const config = currentConfig()
			await createMobileWebDavClient(config, password)
			await saveWebDavConfig(config, password || undefined)
			toast.success('WebDAV 配置已保存')
		} catch (error) {
			toastAndLogError('保存 WebDAV 配置失败', error, 'UI.Settings.Backup')
		}
	}

	const handleRefreshBackups = async () => {
		try {
			await refetchBackups({ throwOnError: true })
			toast.success('云端备份列表已刷新')
		} catch (error) {
			toastAndLogError('读取云端备份失败', error, 'UI.Settings.Backup')
		}
	}

	const handleLocalExport = async () => {
		if (isExportingRef.current) return
		isExportingRef.current = true
		setIsExporting(true)
		try {
			const uri = await createBackup()
			const downloadsUri = exportBackupToDownloads(
				uri,
				`backup-${Date.now()}.zip`,
				'application/zip',
			)
			if (!downloadsUri) throw new Error('无法写入文件')
			toast.success('已导出到下载目录/bbplayer-backup')
		} catch (error) {
			toastAndLogError('导出失败', error, 'UI.Settings.Backup')
		} finally {
			setIsExporting(false)
			isExportingRef.current = false
		}
	}

	const handleLocalImport = async () => {
		if (isImportingRef.current) return
		isImportingRef.current = true
		setIsImporting(true)
		try {
			const result = await DocumentPicker.getDocumentAsync()
			const file = result.canceled ? undefined : result.assets?.[0]
			if (!file) return
			await restoreBackup(file.uri)
			showRestartPrompt()
		} catch (error) {
			toastAndLogError('导入失败', error, 'UI.Settings.Backup')
		} finally {
			setIsImporting(false)
			isImportingRef.current = false
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='备份与恢复' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 110 : 40) },
				]}
			>
				<Text
					variant='titleMedium'
					style={styles.sectionTitle}
				>
					本地备份
				</Text>
				<View style={styles.buttonRow}>
					<Button
						mode='outlined'
						icon='export-variant'
						loading={isExporting}
						disabled={isExporting}
						onPress={() => void handleLocalExport()}
					>
						导出数据
					</Button>
					<Button
						mode='outlined'
						icon='import'
						loading={isImporting}
						disabled={isImporting}
						onPress={() => void handleLocalImport()}
					>
						导入数据
					</Button>
				</View>

				<Divider style={styles.divider} />
				<Text
					variant='titleMedium'
					style={styles.sectionTitle}
				>
					WebDAV
				</Text>
				<TextInput
					label='服务器地址'
					placeholder='https://example.com/dav'
					mode='outlined'
					value={baseUrl}
					autoCapitalize='none'
					autoCorrect={false}
					keyboardType='url'
					onChangeText={setBaseUrl}
					style={styles.input}
				/>
				<TextInput
					label='用户名'
					mode='outlined'
					value={username}
					autoCapitalize='none'
					autoCorrect={false}
					onChangeText={setUsername}
					style={styles.input}
				/>
				<TextInput
					label='密码'
					mode='outlined'
					value={password}
					secureTextEntry
					autoCapitalize='none'
					autoCorrect={false}
					onChangeText={(value) => {
						isPasswordEditedRef.current = true
						setPassword(value)
					}}
					style={styles.input}
				/>
				<TextInput
					label='远端目录'
					mode='outlined'
					value={directory}
					autoCapitalize='none'
					autoCorrect={false}
					onChangeText={setDirectory}
					style={styles.input}
				/>
				<View style={styles.buttonRow}>
					<Button
						mode='outlined'
						loading={testConnectionMutation.isPending}
						disabled={!baseUrl.trim() || testConnectionMutation.isPending}
						onPress={() =>
							testConnectionMutation.mutate({
								config: currentConfig(),
								password,
							})
						}
					>
						测试连接
					</Button>
					<Button
						mode='contained-tonal'
						disabled={!baseUrl.trim()}
						onPress={() => void handleSaveConfig()}
					>
						保存配置
					</Button>
				</View>
				<Button
					mode='contained'
					icon='cloud-upload'
					loading={cloudBackupMutation.isPending}
					disabled={!baseUrl.trim() || cloudBackupMutation.isPending}
					onPress={() =>
						cloudBackupMutation.mutate(
							{ config: currentConfig(), password },
							{
								onSuccess: () => {
									void refetchBackups({ throwOnError: true }).catch((error) =>
										toastAndLogError(
											'读取云端备份失败',
											error,
											'UI.Settings.Backup',
										),
									)
								},
							},
						)
					}
					style={styles.primaryButton}
				>
					立即备份到云端
				</Button>

				<View style={styles.listHeader}>
					<Text variant='titleMedium'>云端备份</Text>
					<IconButton
						icon='refresh'
						size={20}
						loading={isRefreshing}
						disabled={!baseUrl.trim() || isRefreshing}
						onPress={() => void handleRefreshBackups()}
					/>
				</View>
				{(entries?.length ?? 0) === 0 ? (
					<Text
						variant='bodyMedium'
						style={{ color: colors.onSurfaceVariant }}
					>
						暂无云端备份
					</Text>
				) : (
					entries?.map((entry) => (
						<List.Item
							key={entry.path}
							title={formatBackupDate(entry)}
							description={`${formatBytes(entry.size)} · ${entry.name}`}
							left={(props) => (
								<List.Icon
									{...props}
									icon='cloud-check'
								/>
							)}
							right={() => (
								<IconButton
									icon='cloud-download'
									size={20}
									loading={
										cloudRestoreMutation.isPending &&
										cloudRestoreMutation.variables?.entry.path === entry.path
									}
									disabled={cloudRestoreMutation.isPending}
									onPress={() =>
										confirmCloudRestore(entry, (selectedEntry) =>
											cloudRestoreMutation.mutate({
												config: currentConfig(),
												password,
												entry: selectedEntry,
											}),
										)
									}
								/>
							)}
						/>
					))
				)}
			</ScrollView>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

function confirmCloudRestore(
	entry: WebDavEntry,
	restore: (entry: WebDavEntry) => void,
) {
	alert('恢复云端备份', '恢复将覆盖当前的本地歌单和应用设置。确定继续吗？', [
		{ text: '取消' },
		{ text: '恢复', onPress: () => restore(entry) },
	])
}

function showRestartPrompt() {
	alert('恢复完成', '数据已恢复，需要重启应用才能完全生效。是否立即重启？', [
		{ text: '稍后' },
		{ text: '立即重启', onPress: () => void Expo.reloadAppAsync() },
	])
}

function formatBackupDate(entry: WebDavEntry): string {
	return entry.lastModified?.toLocaleString() ?? '未知时间'
}

function formatBytes(size: number): string {
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollView: { flex: 1 },
	scrollContent: { paddingHorizontal: 20 },
	sectionTitle: { marginTop: 16, marginBottom: 8 },
	input: { marginTop: 10 },
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 12,
	},
	primaryButton: { marginTop: 16 },
	divider: { marginTop: 24 },
	listHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 24,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
