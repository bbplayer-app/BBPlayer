import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Appbar, Text, TextInput, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import LinearProgressIndicator from '@/components/common/LinearProgressIndicator'
import { alert } from '@/components/modals/AlertModal'
import useAppStore from '@/hooks/stores/useAppStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { searchGarbSkins } from '@/lib/api/bilibili/garb'
import { installSkinPackage } from '@/lib/theme/skinInstall'
import toast from '@/utils/toast'

export default function ThemeSkinSearchPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const setSettings = useAppStore((state) => state.setSettings)
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<GarbSkinSearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [downloadingItemId, setDownloadingItemId] = useState<number | null>(
		null,
	)
	const [progress, setProgress] = useState(0)

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
		if (!item.packageUrl) {
			alert(
				'暂时无法下载',
				'当前搜索接口没有返回这个主题的资源包下载地址。需要拿到 app 主题接口里的 package_url 后才能安装。',
				[{ text: '知道了' }],
			)
			return
		}

		setDownloadingItemId(item.itemId)
		setProgress(0)
		try {
			const installedSkin = await installSkinPackage({
				item,
				packageUrl: item.packageUrl,
				onProgress: setProgress,
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
			setDownloadingItemId(null)
			setProgress(0)
		}
	}

	const confirmDownload = (item: GarbSkinSearchResult) => {
		alert('下载主题资源包', `是否下载「${item.name}」？`, [
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
					keyExtractor={(item) => String(item.itemId)}
					contentContainerStyle={styles.resultList}
					renderItem={({ item }) => {
						const downloading = downloadingItemId === item.itemId
						return (
							<Pressable
								style={[
									styles.resultRow,
									{ borderBottomColor: colors.outlineVariant },
								]}
								onPress={() => confirmDownload(item)}
								disabled={downloadingItemId !== null}
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
										{item.packageUrl ? '可下载资源包' : '未返回资源包地址'}
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
})
