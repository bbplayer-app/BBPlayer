import { WeeklyHeatMap } from '@bbplayer/heatmap'
import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import Color from 'color'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useIncomingShare } from 'expo-sharing'
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from 'react'
import {
	Keyboard,
	Platform,
	ScrollView,
	StyleSheet,
	ToastAndroid,
	View,
} from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { useMMKVObject } from 'react-native-mmkv'
import { Icon, Searchbar, Text, useTheme } from 'react-native-paper'
import { useAnimatedRef } from 'react-native-reanimated'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import SearchSuggestions, {
	type SearchHistoryItem,
} from '@/features/home/SearchSuggestions'
import { SyncFailuresSheet } from '@/features/playlist/local/components/SyncFailuresSheet'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import { usePlayHistoryHeatmap } from '@/hooks/queries/playHistory'
import { useRecentPlaylists } from '@/hooks/queries/useRecentPlaylists'
import useAppStore from '@/hooks/stores/useAppStore'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { toastAndLogError } from '@/utils/error-handling'
import {
	matchSearchStrategies,
	navigateWithSearchStrategy,
} from '@/utils/search'

const SEARCH_HISTORY_KEY = 'bilibili_search_history'
const MAX_SEARCH_HISTORY = 10

const getGreetingMsg = () => {
	const hour = new Date().getHours()
	if (hour >= 0 && hour < 6) return '凌晨好'
	if (hour >= 6 && hour < 12) return '早上好'
	if (hour >= 12 && hour < 18) return '下午好'
	if (hour >= 18 && hour < 24) return '晚上好'
	return '你好'
}

function HomePage() {
	const theme = useTheme()
	const { colors } = theme
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const [searchHistory, setSearchHistory] =
		useMMKVObject<SearchHistoryItem[]>(SEARCH_HISTORY_KEY)
	const [isLoading, setIsLoading] = useState(false)
	const [searchFocused, setSearchFocused] = useState(false)
	const { resolvedSharedPayloads, isResolving, clearSharedPayloads } =
		useIncomingShare()
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie)
	const enableMinimalistMode = useAppStore(
		(state) => state.settings.enableMinimalistMode,
	)
	const searchBarRef = useAnimatedRef<View>()
	const syncFailuresSheetRef = useRef<TrueSheet>(null)

	const { data: personalInfo } = usePersonalInformation()
	const { data: heatmapData } = usePlayHistoryHeatmap()

	const { data: syncFailures } = useLiveQuery(
		db
			.select({ id: schema.playlistSyncQueue.id })
			.from(schema.playlistSyncQueue)
			.where(eq(schema.playlistSyncQueue.status, 'failed'))
			.limit(1),
	)
	const hasSyncFailures = (syncFailures?.length ?? 0) > 0

	const { data: recentPlaylists } = useRecentPlaylists()

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
			setSearchFocused(false)
		},
		[addSearchHistory, router],
	)

	const handleSuggestionPress = useCallback(
		(query: string) => {
			void handleEnter(query)
		},
		[handleEnter],
	)

	const handleClearHistory = useCallback(() => {
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
	}, [setSearchHistory])

	const handleRemoveHistoryItem = useCallback(
		(id: string) => {
			const item = searchHistory?.find((h) => h.id === id)
			if (!item) return
			alert(
				'删除搜索历史？',
				`确定要删除「${item.text}」吗？`,
				[
					{ text: '取消' },
					{
						text: '确定',
						onPress: () => {
							const newHistory = searchHistory?.filter((h) => h.id !== id)
							setSearchHistory(newHistory)
						},
					},
				],
				{ cancelable: true },
			)
		},
		[searchHistory, setSearchHistory],
	)

	useEffect(() => {
		if (resolvedSharedPayloads.length === 0) return
		if (resolvedSharedPayloads.length > 1) {
			if (Platform.OS === 'android') {
				ToastAndroid.show('收到多个共享内容，已忽略', ToastAndroid.SHORT)
			} else {
				alert(
					'收到多个共享内容，已忽略',
					'当前版本仅支持处理单个共享内容，已忽略其他内容',
					[{ text: '确定' }],
				)
			}
		}
		const data = resolvedSharedPayloads[0]
		let query: string | undefined
		if (data.shareType === 'text') {
			query = data.value
		}
		if (!query) {
			clearSharedPayloads()
			return
		}

		clearSharedPayloads()
		void handleEnter(query)
	}, [resolvedSharedPayloads, clearSharedPayloads, handleEnter])

	if (isResolving) {
		return (
			<View
				style={[
					styles.container,
					{
						backgroundColor: colors.background,
						justifyContent: 'center',
						alignItems: 'center',
					},
				]}
			>
				<ActivityIndicator
					size='large'
					color={colors.primary}
				/>
			</View>
		)
	}

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
							onPress={() => router.push('/settings/bilibili-account' as never)}
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
								onFocus={() => setSearchFocused(true)}
								onBlur={() => setSearchFocused(false)}
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
							visible={searchFocused || searchQuery.length > 0}
							onSuggestionPress={handleSuggestionPress}
							searchBarRef={searchBarRef}
							searchHistory={searchHistory}
							onClearHistory={handleClearHistory}
							onRemoveHistoryItem={handleRemoveHistoryItem}
						/>
					</View>
				</View>

				{/* 快捷操作与内容区，加上 ScrollView 让它可滚动 */}
				{!enableMinimalistMode && (
					<Animated.ScrollView
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
					>
						<WeeklyHeatMap
							data={heatmapData || {}}
							cellSize={18}
							cellGap={4}
							cellRadius={4}
							initialScrollEnd={true}
							locale='zh-cn'
							onCellPress={({ date }) => {
								const dateStr = dayjs(date).format('YYYY-MM-DD')
								router.push(`/history/${dateStr}`)
							}}
							scheme={theme.dark ? 'dark' : 'light'}
							cellColor={{
								1: Color(colors.primary).alpha(0.2).rgb().string(),
								2: Color(colors.primary).alpha(0.4).rgb().string(),
								3: Color(colors.primary).alpha(0.6).rgb().string(),
								4: colors.primary,
							}}
							cellDefaultColor={colors.surfaceVariant}
							headerTextColor={colors.onSurfaceVariant}
							sidebarTextColor={colors.onSurfaceVariant}
							scrollStyle={{ marginHorizontal: 16, marginBottom: 16 }}
						/>
						{/* 快捷入口 */}
						<View style={styles.quickAccessSection}>
							<Text
								variant='titleMedium'
								style={styles.sectionTitle}
							>
								快捷入口
							</Text>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								snapToInterval={156}
								snapToAlignment='start'
								decelerationRate='fast'
								contentContainerStyle={styles.quickAccessScrollContent}
							>
								{/* 那月今日 */}
								<RectButton
									key='on-this-day'
									style={[
										styles.quickAccessCard,
										{ backgroundColor: colors.surfaceVariant },
									]}
									onPress={() => {
										const lastMonth = dayjs()
											.subtract(1, 'month')
											.format('YYYY-MM-DD')
										router.push(`/history/${lastMonth}`)
									}}
								>
									<View
										style={{
											width: 48,
											height: 48,
											borderRadius: 24,
											justifyContent: 'center',
											alignItems: 'center',
										}}
									>
										<Icon
											source='calendar-month'
											size={32}
											color={colors.onSurfaceVariant}
										/>
									</View>
									<Text
										variant='labelMedium'
										style={styles.quickAccessText}
									>
										那月今日
									</Text>
								</RectButton>

								{/* 最近常听 */}
								<RectButton
									key='recently-played'
									style={[
										styles.quickAccessCard,
										{ backgroundColor: colors.surfaceVariant },
									]}
									onPress={() => router.push('/playlist/recently')}
								>
									<View
										style={{
											width: 48,
											height: 48,
											borderRadius: 24,
											justifyContent: 'center',
											alignItems: 'center',
										}}
									>
										<Icon
											source='history'
											size={32}
											color={colors.onSurfaceVariant}
										/>
									</View>
									<Text
										variant='labelMedium'
										style={styles.quickAccessText}
									>
										最近常听
									</Text>
								</RectButton>

								{/* 稍后再看 - conditional on Bilibili cookie */}
								{hasBilibiliCookie() && (
									<RectButton
										key='watch-later'
										style={[
											styles.quickAccessCard,
											{ backgroundColor: colors.surfaceVariant },
										]}
										onPress={() => router.push('/playlist/remote/toview')}
									>
										<View
											style={{
												width: 48,
												height: 48,
												borderRadius: 24,
												justifyContent: 'center',
												alignItems: 'center',
											}}
										>
											<Icon
												source='clock-outline'
												size={32}
												color={colors.onSurfaceVariant}
											/>
										</View>
										<Text
											variant='labelMedium'
											style={styles.quickAccessText}
										>
											稍后再看
										</Text>
									</RectButton>
								)}
							</ScrollView>
						</View>

						{/* 近期歌单 */}
						{recentPlaylists && recentPlaylists.length > 0 && (
							<View style={styles.recentPlaylistsSection}>
								<Text
									variant='titleMedium'
									style={styles.sectionTitle}
								>
									近期歌单
								</Text>
								<Animated.ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									snapToInterval={156}
									snapToAlignment='start'
									decelerationRate='fast'
									contentContainerStyle={styles.horizontalScrollContent}
								>
									{recentPlaylists.map((item) => (
										<RectButton
											key={item.id}
											style={[
												styles.playlistCard,
												{ backgroundColor: colors.surfaceVariant },
											]}
											onPress={() => {
												router.push(`/playlist/local/${item.id}`)
											}}
										>
											<Image
												source={
													item.coverUrl
														? { uri: item.coverUrl }
														: require('../../../assets/images/bilibili-default-avatar.jpg')
												}
												style={styles.playlistCover}
												contentFit='cover'
											/>
											<View style={styles.playlistInfo}>
												<Text
													variant='labelMedium'
													numberOfLines={2}
													style={styles.playlistTitle}
												>
													{item.title}
												</Text>
												<Text
													variant='bodySmall'
													style={{ color: colors.onSurfaceVariant }}
												>
													{item.itemCount} 首
												</Text>
											</View>
										</RectButton>
									))}
								</Animated.ScrollView>
							</View>
						)}
						{/* 底部留白给播放条 */}
						<View style={{ height: 200 }} />
					</Animated.ScrollView>
				)}
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
	scrollContent: {
		paddingTop: 16,
	},
	sectionTitle: {
		paddingHorizontal: 16,
		fontWeight: 'bold',
		marginBottom: 16,
	},
	quickAccessSection: {
		marginBottom: 32,
	},
	quickAccessCard: {
		width: 140,
		borderRadius: 12,
		overflow: 'hidden',
		paddingVertical: 16,
		paddingHorizontal: 12,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	quickAccessText: {
		fontWeight: '600',
	},
	quickAccessScrollContent: {
		paddingHorizontal: 16,
		gap: 16,
	},
	recentPlaylistsSection: {
		marginBottom: 32,
	},
	horizontalScrollContent: {
		paddingHorizontal: 16,
		gap: 16,
	},
	playlistCard: {
		width: 140,
		borderRadius: 12,
		overflow: 'hidden',
		paddingBottom: 12,
	},
	playlistCover: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: 12,
	},
	playlistInfo: {
		paddingHorizontal: 12,
		paddingTop: 10,
	},
	playlistTitle: {
		fontWeight: '600',
		marginBottom: 4,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})

export default HomePage
