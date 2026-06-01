import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Appbar, Text, TextInput, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { searchGarbSkins } from '@/lib/api/bilibili/garb'
import toast from '@/utils/toast'

const resultKey = (item: GarbSkinSearchResult) =>
	`${item.kind ?? 'unknown'}-${item.actId ?? item.itemId}-${item.name}`

export default function ThemeSkinSearchPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<GarbSkinSearchResult[]>([])
	const [searching, setSearching] = useState(false)

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

	const startDownload = (item: GarbSkinSearchResult) => {
		if (!item.kind) {
			alert('暂时无法下载', '当前只支持下载收藏集和主题装扮。', [
				{ text: '知道了' },
			])
			return
		}

		openModal('SkinDownloadProgress', { item }, { dismissible: false })
	}

	const confirmDownload = (item: GarbSkinSearchResult) => {
		const label = item.kind === 'collection' ? '收藏集' : '主题装扮'
		alert('下载主题资源包', `是否下载「${item.name}」${label}资产？`, [
			{ text: '取消' },
			{
				text: '下载',
				onPress: () => {
					startDownload(item)
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
						return (
							<Pressable
								style={[
									styles.resultRow,
									{ borderBottomColor: colors.outlineVariant },
								]}
								onPress={() => confirmDownload(item)}
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
	empty: {
		marginTop: 32,
		textAlign: 'center',
	},
})
