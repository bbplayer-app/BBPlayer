import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import { eq } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useShareIntentContext } from 'expo-share-intent'
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { useMMKVObject } from 'react-native-mmkv'
import { Chip, Searchbar, Text, useTheme } from 'react-native-paper'
import { useAnimatedRef } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import SearchSuggestions from '@/features/home/SearchSuggestions'
import { SyncFailuresSheet } from '@/features/playlist/local/components/SyncFailuresSheet'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { queryClient } from '@/lib/config/queryClient'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { toastAndLogError } from '@/utils/error-handling'
import {
	matchSearchStrategies,
	navigateWithSearchStrategy,
} from '@/utils/search'
import toast from '@/utils/toast'

const SEARCH_HISTORY_KEY = 'bilibili_search_history'
const MAX_SEARCH_HISTORY = 10

interface SearchHistoryItem {
	id: string
	text: string
	timestamp: number
}

const getGreetingMsg = () => {
	const hour = new Date().getHours()
	if (hour >= 0 && hour < 6) return '凌晨好'
	if (hour >= 6 && hour < 12) return '早上好'
	if (hour >= 12 && hour < 18) return '下午好'
	if (hour >= 18 && hour < 24) return '晚上好'
	return '你好'
}

function HomePage() {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const [searchHistory, setSearchHistory] =
		useMMKVObject<SearchHistoryItem[]>(SEARCH_HISTORY_KEY)
	const [isLoading, setIsLoading] = useState(false)
	const { hasShareIntent, shareIntent, resetShareIntent } =
		useShareIntentContext()
	const clearBilibiliCookie = useAppStore((state) => state.clearBilibiliCookie)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie)
	const searchBarRef = useAnimatedRef<View>()
	const syncFailuresSheetRef = useRef<TrueSheet>(null)

	const { data: personalInfo } = usePersonalInformation()

	const { data: syncFailures } = useLiveQuery(
		db
			.select({ id: schema.playlistSyncQueue.id })
			.from(schema.playlistSyncQueue)
			.where(eq(schema.playlistSyncQueue.status, 'failed'))
			.limit(1),
	)
	const hasSyncFailures = (syncFailures?.length ?? 0) > 0

	const greeting = getGreetingMsg()

	const saveSearchHistory = useCallback(
		(history: SearchHistoryItem[]) => {
			try {
				setSearchHistory(history)
			} catch (error) {
				toastAndLogError('保存搜索历史失败', error, 'UI.Home')
			}
		},
		[setSearchHistory],
	)

	const addSearchHistory = useCallback(
		(query: string) => {
			if (!query.trim()) return

			const newItem: SearchHistoryItem = {
				id: `history_${Date.now()}`,
				text: query,
				timestamp: Date.now(),
			}

			const currentHistory = searchHistory ?? []
			const existingIndex = currentHistory.findIndex(
				(item) => item.text.toLowerCase() === query.toLowerCase(),
			)

			let newHistory: SearchHistoryItem[]

			if (existingIndex !== -1) {
				newHistory = [
					newItem,
					...currentHistory.filter(
						(item) => item.text.toLowerCase() !== query.toLowerCase(),
					),
				]
			} else {
				newHistory = [newItem, ...currentHistory]
			}

			if (newHistory.length > MAX_SEARCH_HISTORY) {
				newHistory = newHistory.slice(0, MAX_SEARCH_HISTORY)
			}

			saveSearchHistory(newHistory)
		},
		[searchHistory, saveSearchHistory],
	)

	const handleEnter = useCallback(
		async (query: string) => {
			if (!query.trim()) return
			Keyboard.dismiss()
			setIsLoading(true)
			const addToHistory = await matchSearchStrategies(query)
			const needAddToHistory = navigateWithSearchStrategy(addToHistory, router)
			if (needAddToHistory === 1) {
				addSearchHistory(query)
			}
			setIsLoading(false)
			setSearchQuery('')
		},
		[addSearchHistory, router],
	)

	const handleSuggestionPress = (query: string) => {
		void handleEnter(query)
	}

	const handleSearchItemClick = (query: string) => {
		// 直接跳转到搜索页面，我们可以确定，所有保存的搜索历史都是有效的关键词，而非 url/id 什么的
		router.push({
			pathname: '/playlist/remote/search-result/global/[query]',
			params: { query },
		})
	}

	useEffect(() => {
		if (!hasShareIntent) return
		const query = (shareIntent?.webUrl ?? shareIntent?.text ?? '').trim()
		if (!query) {
			resetShareIntent()
			return
		}

		resetShareIntent()
		void handleEnter(query)
	}, [hasShareIntent, shareIntent, router, resetShareIntent, handleEnter])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			{/*顶部欢迎区域*/}
			<View
				style={{
					paddingTop: insets.top + 8,
				}}
			>
				<View style={[styles.greetingContainer, { paddingHorizontal: 16 }]}>
					<View>
						<Text
							variant='headlineSmall'
							style={styles.headline}
						>
							BBPlayer
						</Text>
						<Text
							variant='bodyMedium'
							style={{ color: colors.onSurfaceVariant }}
						>
							{greeting}，{personalInfo?.name || '陌生人'}
						</Text>
					</View>
					<View style={styles.headerRight}>
						{hasSyncFailures && (
							<IconButton
								icon='alert-circle'
								size={22}
								iconColor={colors.error}
								onPress={() => void syncFailuresSheetRef.current?.present()}
							/>
						)}
						<RectButton
							enabled={hasBilibiliCookie()}
							onPress={() =>
								alert(
									'退出登录？',
									'是否退出登录？',
									[
										{ text: '取消' },
										{
											text: '确定',
											onPress: async () => {
												clearBilibiliCookie()
												await queryClient.cancelQueries()
												queryClient.clear()
												toast.success('Cookie\u2009已清除')
											},
										},
									],
									{ cancelable: true },
								)
							}
							style={styles.avatarButton}
						>
							<Image
								style={styles.avatarImage}
								source={
									personalInfo?.face
										? { uri: personalInfo.face }
										: // oxlint-disable-next-line @typescript-eslint/no-require-imports
											require('../../../assets/images/bilibili-default-avatar.jpg')
								}
								cachePolicy={'disk'}
							/>
						</RectButton>
					</View>
				</View>

				<View style={styles.searchSection}>
					{/* 搜索栏 */}
					<View style={styles.searchbarContainer}>
						<View ref={searchBarRef}>
							<Searchbar
								placeholder={
									'关键词\u2009/\u2009b23.tv\u2009/\u2009完整网址\u2009/\u2009av\u2009/\u2009bv'
								}
								onChangeText={setSearchQuery}
								value={searchQuery}
								icon={isLoading ? 'loading' : 'magnify'}
								onClearIconPress={() => setSearchQuery('')}
								onSubmitEditing={() => handleEnter(searchQuery)}
								elevation={0}
								mode='bar'
								style={[
									styles.searchbar,
									{ backgroundColor: colors.surfaceVariant },
								]}
								testID='search-bar'
							/>
						</View>
						<SearchSuggestions
							query={deferredSearchQuery}
							visible={searchQuery.length > 0}
							onSuggestionPress={handleSuggestionPress}
							searchBarRef={searchBarRef}
						/>
					</View>

					{/* 搜索历史 */}
					<View style={styles.historySection}>
						<View style={styles.historyHeader}>
							<Text
								variant='titleMedium'
								style={styles.historyTitle}
							>
								最近搜索
							</Text>
							{searchHistory && searchHistory.length > 0 && (
								<IconButton
									icon='trash-can-outline'
									size={20}
									onPress={() =>
										alert(
											'清空搜索历史？',
											'确定要清空吗？',
											[
												{ text: '取消' },
												{
													text: '确定',
													onPress: () => {
														setSearchHistory([])
													},
												},
											],
											{ cancelable: true },
										)
									}
								/>
							)}
						</View>
						{searchHistory && searchHistory.length > 0 ? (
							<View style={styles.historyChipsContainer}>
								{searchHistory.map((item) => (
									<Chip
										key={item.id}
										onPress={() => handleSearchItemClick(item.text)}
										onLongPress={() =>
											alert(
												'删除搜索历史？',
												`确定要删除「${item.text}」吗？`,
												[
													{ text: '取消' },
													{
														text: '确定',
														onPress: () => {
															// 优化：使用 filter 创建新数组，避免直接修改 state
															const newHistory = searchHistory.filter(
																(h) => h.id !== item.id,
															)
															setSearchHistory(newHistory)
														},
													},
												],
												{ cancelable: true },
											)
										}
										style={styles.chip}
										mode='outlined'
									>
										{item.text}
									</Chip>
								))}
							</View>
						) : (
							<Text
								style={[
									styles.noHistoryText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								暂无搜索历史
							</Text>
						)}
					</View>
				</View>
			</View>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
			<SyncFailuresSheet ref={syncFailuresSheetRef} />
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	greetingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headline: {
		fontWeight: 'bold',
	},
	avatarButton: {
		borderRadius: 20,
		overflow: 'hidden',
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	avatarImage: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	searchSection: {
		marginTop: 16,
	},
	searchbarContainer: {
		paddingTop: 10,
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	searchbar: {
		borderRadius: 9999,
	},
	historySection: {
		marginTop: 16,
		marginBottom: 24,
		marginHorizontal: 16,
	},
	historyHeader: {
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	historyTitle: {
		fontWeight: 'bold',
	},
	historyChipsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginHorizontal: 5,
	},
	chip: {
		marginRight: 8,
		marginBottom: 8,
	},
	noHistoryText: {
		paddingVertical: 8,
		textAlign: 'center',
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})

export default HomePage
