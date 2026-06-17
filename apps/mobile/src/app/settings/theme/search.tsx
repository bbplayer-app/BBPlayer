import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, Text, TextInput, useTheme } from 'react-native-paper'
import { MD3Colors } from 'react-native-paper/src/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import { useThemeSearch } from '@/hooks/queries/bilibili/theme'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { BilibiliGarbSearchItem } from '@/types/apis/bilibili'
import { ListRenderItemInfoWithExtraData } from '@/types/flashlist'

const resultKey = (item: GarbSkinSearchResult) =>
	`${item.kind ?? 'unknown'}-${item.actId ?? item.itemId}-${item.name}`

const mapSearchItem = (item: BilibiliGarbSearchItem): GarbSkinSearchResult => {
	const { part_id: partId, properties: props } = item
	return {
		actId: Number(props.dlc_act_id) || null,
		coverUri:
			props.image_cover ??
			props.image_cover_long ??
			props.fan_share_image ??
			null,
		itemId: item.item_id || null,
		kind: partId === 0 ? 'collection' : partId === 6 ? 'suit' : null,
		lotteryId: Number(props.dlc_lottery_id) || null,
		name: item.name || '未命名装扮',
		partId: partId ?? null,
	}
}

const confirmDownload = (item: GarbSkinSearchResult) => {
	const label = item.kind === 'collection' ? '收藏集' : '主题装扮'
	const openModal = useModalStore.getState().open
	alert('下载主题资源包', `是否下载「${item.name}」${label}资产？`, [
		{ text: '取消' },
		{
			text: '下载',
			onPress: () => {
				if (!item.kind) {
					alert('暂时无法下载', '当前只支持下载收藏集和主题装扮。', [
						{ text: '知道了' },
					])
					return
				}

				openModal('SkinDownloadProgress', { item }, { dismissible: false })
			},
		},
	])
}

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	GarbSkinSearchResult,
	{ colors: MD3Colors }
>) => {
	if (!extraData) throw new Error('extraData is undefined')
	const colors = extraData.colors
	return (
		<Pressable
			style={[styles.resultRow, { borderBottomColor: colors.outlineVariant }]}
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
					style={[styles.cover, { backgroundColor: colors.surfaceVariant }]}
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
}

export default function ThemeSkinSearchPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const [query, setQuery] = useState('')
	const [bufferedInput, setBufferedInput] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const {
		data: searchResult,
		isFetching,
		isFetchingNextPage,
		hasNextPage,
		refetch,
		fetchNextPage,
	} = useThemeSearch(query)
	const resultsToDisplay = useMemo(() => {
		return (
			searchResult?.pages.flatMap((page) => page.list).map(mapSearchItem) ?? []
		)
	}, [searchResult])
	const extraData = useMemo(() => ({ colors }), [colors])

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
						value={bufferedInput}
						onChangeText={setBufferedInput}
						style={styles.searchInput}
						onSubmitEditing={() => setQuery(bufferedInput)}
						returnKeyType='search'
					/>
					<Button
						onPress={() => setQuery(bufferedInput)}
						loading={isFetching}
						disabled={isFetching}
					>
						搜索
					</Button>
				</View>

				<FlashList
					data={resultsToDisplay}
					keyExtractor={resultKey}
					contentContainerStyle={styles.resultList}
					showsVerticalScrollIndicator={false}
					onEndReached={fetchNextPage}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true)
								await refetch()
								setRefreshing(false)
							}}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					extraData={extraData}
					renderItem={renderItem}
					ListEmptyComponent={
						<Text
							variant='bodySmall'
							style={[styles.empty, { color: colors.onSurfaceVariant }]}
						>
							输入主题名称搜索 B 站装扮
						</Text>
					}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View style={styles.footerLoadingContainer}>
								<ActivityIndicator size='small' />
							</View>
						) : hasNextPage ? (
							<Text
								variant='titleMedium'
								style={styles.footerReachedEnd}
							>
								•
							</Text>
						) : null
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
	footerLoadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	footerReachedEnd: {
		textAlign: 'center',
		paddingTop: 10,
	},
})
