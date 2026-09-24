import { clearCacheAsync } from '@bbplayer/native'
import { Orpheus } from '@bbplayer/orpheus'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Button,
	Divider,
	List,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import StorageUsageChart, {
	type StorageSegment,
} from '@/features/storage/StorageUsageChart'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useStorageUsage } from '@/hooks/queries/native/storage'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { type MenuEntry, useMenuActions } from '@/hooks/ui/useMenuActions'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

const DOWNLOAD_PARALLEL_OPTIONS = [
	{ value: 1, label: '1 个（稳妥）' },
	{ value: 2, label: '2 个' },
	{ value: 3, label: '3 个' },
	{ value: 6, label: '6 个（最快）' },
] as const

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB', 'TB']
	let value = bytes
	let unit = -1
	do {
		value /= 1024
		unit++
	} while (value >= 1024 && unit < units.length - 1)
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

interface UsageItem extends StorageSegment {
	description: string
	icon: string
	key: string
	onPress?: () => void
}

const clearImageCache = async () => {
	try {
		await Image.clearDiskCache()
		await Image.clearMemoryCache()
		toast.success('已清空图片缓存')
	} catch (e) {
		toastAndLogError('清空图片缓存失败', e, 'UI.Settings.General')
	}
}

export default function StorageSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const isAndroid = Platform.OS === 'android'
	const isReady = useScreenTransitionReady()
	const [isClearing, setIsClearing] = useState(false)
	const openModal = useModalStore((state) => state.open)
	const setSettings = useAppStore((state) => state.setSettings)

	const downloadMaxParallelTasks = useAppStore(
		(state) => state.settings.downloadMaxParallelTasks,
	)

	const menuActions = useMenuActions(
		DOWNLOAD_PARALLEL_OPTIONS.map((option): MenuEntry => ({
			title: option.label,
			state: downloadMaxParallelTasks === option.value ? 'on' : 'off',
			onPress: () => {
				setSettings({ downloadMaxParallelTasks: option.value })
			},
		})),
	)

	// 等屏幕过渡动画结束后再开始统计，避免遍历磁盘拖慢转场。
	const {
		data: usage,
		error: usageError,
		isPending,
		isError,
		refetch,
	} = useStorageUsage(isAndroid && isReady)

	useEffect(() => {
		if (isError) {
			toastAndLogError('读取存储占用失败', usageError, 'StorageSettings')
		}
	}, [isError, usageError])

	const items = useMemo<UsageItem[]>(() => {
		if (!usage) return []
		return [
			{
				key: 'runtimeCache',
				label: '运行数据缓存',
				description: '图片、临时文件等',
				icon: 'cached',
				color: colors.primary,
				value: usage.runtimeCacheBytes,
			},
			{
				key: 'musicCache',
				label: '音乐缓存',
				description: `在线播放缓存（上限 ${formatBytes(usage.musicCacheMaxBytes)}）`,
				icon: 'music-note',
				color: colors.tertiary,
				value: usage.musicCacheBytes,
			},
			{
				key: 'download',
				label: '下载',
				description: '已下载的音乐与封面',
				icon: 'download',
				color: colors.secondary,
				value: usage.downloadBytes,
				onPress: () => router.push('/downloaded'),
			},
			{
				key: 'other',
				label: '其他应用数据',
				description: '歌单、设置、歌词等持久化数据',
				icon: 'database',
				color: colors.outline,
				value: usage.otherBytes,
			},
			{
				key: 'package',
				label: '应用包大小',
				description: '安装包本身，无法清理',
				icon: 'package-variant-closed',
				color: colors.error,
				value: usage.packageBytes,
			},
		]
	}, [usage, colors, router])

	const total = useMemo(
		() => items.reduce((sum, item) => sum + item.value, 0),
		[items],
	)
	const clearable = usage ? usage.runtimeCacheBytes + usage.musicCacheBytes : 0

	const clearCache = async () => {
		if (isClearing) return
		setIsClearing(true)
		try {
			// 图片缓存由 expo-image 自己管理；其余运行数据缓存由 native 处理；
			// Media3 在线播放缓存由 orpheus 处理。
			const imageCacheCleared = await Image.clearDiskCache()
			if (!imageCacheCleared) throw new Error('图片磁盘缓存清理失败')
			await clearCacheAsync()
			await Orpheus.clearPlaybackCache()
			await refetch()
			toast.success('缓存已清理')
		} catch (error) {
			toastAndLogError('清理缓存失败', error, 'StorageSettings')
		} finally {
			setIsClearing(false)
		}
	}

	const confirmClearCache = () => {
		Alert.alert(
			'清理缓存',
			'将删除临时文件、图片和在线播放缓存。已下载的音乐不会删除。',
			[
				{ text: '取消', style: 'cancel' },
				{
					text: '清理',
					style: 'destructive',
					onPress: () => void clearCache(),
				},
			],
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='下载与存储' />
			</Appbar.Header>
			<ScrollView
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 20) },
				]}
			>
				<SettingsSectionTitle
					title='下载'
					first
				/>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>同时下载数量</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							当前 {downloadMaxParallelTasks} 个
						</Text>
					</View>
					<MenuView {...menuActions}>
						<IconButton
							icon='download-multiple'
							size={20}
						/>
					</MenuView>
				</View>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>下载缺失封面</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							为本地音乐补全缺失的封面图
						</Text>
					</View>
					<IconButton
						icon='image-sync'
						size={20}
						onPress={() => openModal('CoverDownloadProgress', undefined)}
					/>
				</View>

				{isAndroid ? (
					<>
						<SettingsSectionTitle title='存储' />
						{isPending ? (
							<View style={styles.chartPlaceholder}>
								<Text
									variant='bodyMedium'
									style={{ color: colors.onSurfaceVariant }}
								>
									计算中...
								</Text>
							</View>
						) : usage ? (
							<StorageUsageChart
								segments={items}
								totalLabel={formatBytes(total)}
							/>
						) : null}
						{usage && (
							<Text
								variant='bodySmall'
								style={[styles.caption, { color: colors.onSurfaceVariant }]}
							>
								可清理 {formatBytes(clearable)}
							</Text>
						)}
						{isError && (
							<Text style={[styles.error, { color: colors.error }]}>
								存储占用读取失败，请重新进入页面。
							</Text>
						)}
						<View style={styles.list}>
							{items.map((item, index) => (
								<View key={item.key}>
									{index > 0 && <Divider style={styles.divider} />}
									<List.Item
										title={item.label}
										description={item.description}
										left={(props) => (
											<List.Icon
												{...props}
												color={item.color}
												icon={item.icon}
											/>
										)}
										right={() => (
											<View style={styles.rowEnd}>
												<View style={styles.valueColumn}>
													<Text>{formatBytes(item.value)}</Text>
													<Text
														variant='bodySmall'
														style={{ color: colors.onSurfaceVariant }}
													>
														{total > 0
															? `${((item.value / total) * 100).toFixed(1)}%`
															: '0%'}
													</Text>
												</View>
												{item.onPress && (
													<List.Icon
														icon='chevron-right'
														color={colors.onSurfaceVariant}
													/>
												)}
											</View>
										)}
										onPress={item.onPress}
									/>
								</View>
							))}
						</View>
						<Button
							mode='contained-tonal'
							icon='delete-sweep'
							loading={isClearing}
							disabled={isClearing || isPending || !usage}
							onPress={confirmClearCache}
						>
							清理缓存
						</Button>
						<Button
							mode='text'
							icon='image-remove'
							onPress={() => void clearImageCache()}
						>
							仅清空图片缓存
						</Button>
					</>
				) : (
					<Text
						style={[styles.unsupported, { color: colors.onSurfaceVariant }]}
					>
						存储管理目前仅支持 Android。
					</Text>
				)}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },
	chartPlaceholder: {
		alignItems: 'center',
		height: 208,
		justifyContent: 'center',
	},
	caption: { marginTop: 4, textAlign: 'center' },
	list: { marginVertical: 16 },
	divider: { marginVertical: 2 },
	rowEnd: { alignItems: 'center', flexDirection: 'row', gap: 4 },
	valueColumn: { alignItems: 'flex-end' },
	error: { marginTop: 8, textAlign: 'center' },
	unsupported: { marginTop: 16, textAlign: 'center' },
	settingRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 16,
	},
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
})
