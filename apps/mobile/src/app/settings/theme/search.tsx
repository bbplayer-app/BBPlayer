import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Appbar, Text, TextInput, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import Button from '@/components/common/Button'
import LinearProgressIndicator from '@/components/common/LinearProgressIndicator'
import { alert } from '@/components/modals/AlertModal'
import useAppStore from '@/hooks/stores/useAppStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { searchGarbSkins } from '@/lib/api/bilibili/garb'
import { installSkinPackage } from '@/lib/theme/skinInstall'
import toast from '@/utils/toast'

const resultKey = (item: GarbSkinSearchResult) =>
	`${item.kind ?? 'unknown'}-${item.actId ?? item.itemId}-${item.name}`

export default function ThemeSkinSearchPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const setSettings = useAppStore((state) => state.setSettings)
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<GarbSkinSearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
	const [progress, setProgress] = useState(0)
	const [progressLabel, setProgressLabel] = useState('')
	const [progressCount, setProgressCount] = useState({ completed: 0, total: 0 })

	const search = async () => {
		const trimmed = query.trim()
		if (!trimmed) return

		setSearching(true)
		try {
			setResults(await searchGarbSkins(trimmed))
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error))
		} finally {
			setSearching(false)
		}
	}

	const startDownload = async (item: GarbSkinSearchResult) => {
		if (!item.kind) {
			alert('暂时无法下载', '当前只支持下载收藏集和主题装扮。', [
				{ text: '知道了' },
			])
			return
		}

		setDownloadingKey(resultKey(item))
		setProgress(0)
		setProgressLabel('准备下载')
		setProgressCount({ completed: 0, total: 0 })
		try {
			const installedSkin = await installSkinPackage({
				item,
				onProgress: (event) => {
					setProgress(event.progress)
					setProgressLabel(event.label)
					setProgressCount({
						completed: event.completed,
						total: event.total,
					})
				},
			})
			setSettings({
				installedSkins: [
					installedSkin,
					...useAppStore
						.getState()
						.settings.installedSkins.filter(
							(skin) => skin.id !== installedSkin.id,
						),
				],
			})
			alert('主题下载完成', '是否现在去启用这个主题？', [
				{ text: '稍后' },
				{
					text: '去启用',
					onPress: () => router.replace('/settings/theme'),
				},
			])
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error))
		} finally {
			setDownloadingKey(null)
			setProgress(0)
			setProgressLabel('')
			setProgressCount({ completed: 0, total: 0 })
		}
	}

	const confirmDownload = (item: GarbSkinSearchResult) => {
		const label = item.kind === 'collection' ? '收藏集' : '主题装扮'
		alert('下载主题资源包', `是否下载「${item.name}」${label}资产？`, [
			{ text: '取消' },
			{
				text: '下载',
				onPress: () => {
					void startDownload(item)
				},
			},
		])
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='添加主题' />
			</Appbar.Header>
			<View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
				<View style={styles.searchRow}>
					<TextInput
						mode='outlined'
						label='主题名称'
						value={query}
						onChangeText={setQuery}
						style={styles.searchInput}
						onSubmitEditing={search}
						returnKeyType='search'
					/>
					<Button
						onPress={search}
						loading={searching}
						disabled={searching}
					>
						搜索
					</Button>
				</View>

				<FlatList
					data={results}
					keyExtractor={resultKey}
					contentContainerStyle={styles.resultList}
					renderItem={({ item }) => {
						const downloading = downloadingKey === resultKey(item)
						return (
							<Pressable
								style={[
									styles.resultRow,
									{ borderBottomColor: colors.outlineVariant },
								]}
								onPress={() => confirmDownload(item)}
								disabled={downloadingKey !== null}
							>
								{item.coverUri ? (
									<Image
										source={{ uri: item.coverUri }}
										style={styles.cover}
										contentFit='cover'
									/>
								) : (
									<View
										style={[
											styles.cover,
											{ backgroundColor: colors.surfaceVariant },
										]}
									/>
								)}
								<View style={styles.resultText}>
									<Text numberOfLines={1}>{item.name}</Text>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										{item.kind === 'collection'
											? `收藏集 · act_id=${item.actId ?? '-'}`
											: item.kind === 'suit'
												? `主题装扮 · item_id=${item.itemId}`
												: '暂不支持的装扮类型'}
									</Text>
									<LinearProgressIndicator
										visible={downloading}
										progress={progress}
										style={styles.progress}
									/>
								</View>
							</Pressable>
						)
					}}
					ListEmptyComponent={
						<Text
							variant='bodySmall'
							style={[styles.empty, { color: colors.onSurfaceVariant }]}
						>
							输入主题名称搜索 B 站装扮
						</Text>
					}
				/>
			</View>
			<AnimatedModalOverlay
				visible={downloadingKey !== null}
				onDismiss={() => {}}
				contentStyle={styles.downloadModal}
			>
				<View style={styles.downloadContent}>
					<Text variant='titleMedium'>正在下载主题资产</Text>
					<Text
						variant='bodySmall'
						numberOfLines={2}
						style={{ color: colors.onSurfaceVariant }}
					>
						{progressLabel || '准备下载'}
					</Text>
					<LinearProgressIndicator
						progress={progress}
						style={styles.modalProgress}
					/>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						{progressCount.total > 0
							? `${progressCount.completed}/${progressCount.total}`
							: '正在获取资产清单'}
					</Text>
				</View>
			</AnimatedModalOverlay>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: 20,
	},
	searchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	searchInput: {
		flex: 1,
	},
	resultList: {
		paddingTop: 12,
	},
	resultRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	cover: {
		width: 56,
		height: 56,
		borderRadius: 8,
	},
	resultText: {
		flex: 1,
		gap: 4,
	},
	progress: {
		marginTop: 4,
	},
	empty: {
		marginTop: 32,
		textAlign: 'center',
	},
	downloadModal: {
		paddingHorizontal: 18,
		paddingBottom: 18,
	},
	downloadContent: {
		gap: 12,
	},
	modalProgress: {
		marginTop: 4,
	},
})
