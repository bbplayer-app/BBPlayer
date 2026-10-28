import { File } from 'expo-file-system'
import { useObserve } from 'expo-observe'
import { useFocusEffect, useRouter } from 'expo-router'
import { useIncomingShare } from 'expo-sharing'
import {
	type ComponentRef,
	useCallback,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from 'react'
import {
	AppState,
	BackHandler,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	ToastAndroid,
	View,
} from 'react-native'
import { useMMKVObject } from 'react-native-mmkv'
import { Searchbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { alert } from '@/components/modals/AlertModal'
import SkinAppbarBackground from '@/components/navigation/SkinAppbarBackground'
import SearchHistory, {
	type SearchHistoryItem,
} from '@/features/search/SearchHistory'
import SearchSuggestions from '@/features/search/SearchSuggestions'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import useSkinForegroundColor from '@/hooks/theme/useSkinForegroundColor'
import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'
import { queryClient } from '@/lib/config/queryClient'
import { syncExternalPlaylistFacade } from '@/lib/facades/syncExternalPlaylist'
import { markPerfInteractive } from '@/lib/performance'
import { playlistOutService } from '@/lib/services/playlistOutService'
import { toastAndLogError } from '@/utils/error-handling'
import {
	matchSearchStrategies,
	navigateWithSearchStrategy,
} from '@/utils/search'
import toast from '@/utils/toast'

const SEARCH_HISTORY_KEY = 'bilibili_search_history'
const MAX_SEARCH_HISTORY = 10

export default function SearchPage() {
	useNowPlayingBar()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const haveTrack = useCurrentTrack()
	const headerForegroundColor = useSkinForegroundColor()
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const [searchHistory, setSearchHistory] =
		useMMKVObject<SearchHistoryItem[]>(SEARCH_HISTORY_KEY)
	const [isLoading, setIsLoading] = useState(false)
	const [searchFocused, setSearchFocused] = useState(false)
	const suggestionsVisible =
		searchFocused &&
		searchQuery.trim().length > 0 &&
		deferredSearchQuery.trim().length > 0
	const searchBarRef = useRef<ComponentRef<typeof Searchbar>>(null)
	const dismissPanel = useCallback(() => {
		setSearchFocused(false)
		searchBarRef.current?.blur()
		Keyboard.dismiss()
	}, [])
	useFocusEffect(
		useCallback(() => {
			const backSubscription = BackHandler.addEventListener(
				'hardwareBackPress',
				() => {
					if (!searchFocused) return false
					dismissPanel()
					return true
				},
			)
			// Android 在输入法打开时会先由系统处理返回键，此时仍需收起面板。
			const keyboardSubscription = Keyboard.addListener(
				'keyboardDidHide',
				dismissPanel,
			)
			return () => {
				backSubscription.remove()
				keyboardSubscription.remove()
			}
		}, [dismissPanel, searchFocused]),
	)
	useFocusEffect(useCallback(() => () => dismissPanel(), [dismissPanel]))
	const [contentHeight, setContentHeight] = useState(0)
	const contentBottomPadding = haveTrack ? 86 : 24
	const {
		resolvedSharedPayloads,
		isResolving,
		clearSharedPayloads,
		refreshSharePayloads,
	} = useIncomingShare()
	const { markInteractive } = useObserve()
	useEffect(() => {
		markInteractive()
		void markPerfInteractive()
	}, [markInteractive])

	const saveSearchHistory = useCallback(
		(history: SearchHistoryItem[]) => {
			try {
				setSearchHistory(history)
			} catch (error) {
				toastAndLogError('保存搜索历史失败', error, 'UI.Search')
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
			dismissPanel()
			setIsLoading(true)
			try {
				const result = await matchSearchStrategies(query)
				if (navigateWithSearchStrategy(result, router) === 1) {
					addSearchHistory(query)
				}
				setSearchQuery('')
			} catch (error) {
				toastAndLogError('搜索失败，请重试', error, 'UI.Search')
			} finally {
				setIsLoading(false)
			}
		},
		[addSearchHistory, dismissPanel, router],
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

	const handleIncomingJsonContent = useCallback(
		async (content: string, fallbackTitle = '本地导入歌单') => {
			const jsonRes = playlistOutService.parseJsonPlaylist(
				content,
				fallbackTitle,
			)
			if (jsonRes.isErr()) {
				toast.error(`解析歌单文件失败: ${jsonRes.error.message}`)
				return
			}

			const parsedData = jsonRes.value
			const allTracksHaveBvid =
				parsedData.tracks.length > 0 &&
				parsedData.tracks.every((t) => Boolean(t.bilibili?.bvid))

			if (
				allTracksHaveBvid &&
				playlistOutService.isDirectBilibiliPlaylist(parsedData)
			) {
				const loadingToast = toast.loading('正在导入哔哩哔哩歌单...')
				try {
					const saveRes =
						await syncExternalPlaylistFacade.saveDirectBilibiliPlaylist(
							parsedData.playlist,
							parsedData.tracks,
						)
					toast.dismiss(loadingToast)
					if (saveRes.isErr()) {
						toast.error(`直接导入失败: ${saveRes.error.message}`)
						return
					}
					await queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistLists(),
					})
					toast.success('哔哩哔哩歌单已直接导入到本地')
					router.navigate(`/playlist/local/${saveRes.value}`)
				} catch (e) {
					toast.dismiss(loadingToast)
					toast.error(
						`直接导入失败: ${e instanceof Error ? e.message : String(e)}`,
					)
				}
				return
			}

			const cacheId = parsedData.playlist.id
			playlistOutService.setCachedPlaylist(cacheId, parsedData)
			router.navigate({
				pathname: '/playlist/external-sync',
				params: { id: cacheId, source: 'local_json' },
			})
		},
		[router],
	)

	const handleIncomingFileUri = useCallback(
		async (uri: string, originalName?: string | null) => {
			try {
				const file = new File(uri)
				const content = await file.text()
				const fallbackTitle = originalName
					? originalName.replace(/\.json$/i, '')
					: '本地导入歌单'
				await handleIncomingJsonContent(content, fallbackTitle)
			} catch (e) {
				toast.error(
					`读取歌单文件失败: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
		},
		[handleIncomingJsonContent],
	)

	const checkPendingFile = useCallback(() => {
		const pendingUri = playlistOutService.consumePendingIncomingFileUri()
		if (pendingUri) {
			void handleIncomingFileUri(pendingUri)
		}
	}, [handleIncomingFileUri])

	useFocusEffect(
		useCallback(() => {
			checkPendingFile()
			refreshSharePayloads()
		}, [checkPendingFile, refreshSharePayloads]),
	)

	useEffect(() => {
		checkPendingFile()
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				checkPendingFile()
			}
		})
		return () => sub.remove()
	}, [checkPendingFile])

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
		const isLocalFile =
			(data.shareType === 'file' ||
				('contentType' in data && data.contentType === 'file')) &&
			(('contentUri' in data && Boolean(data.contentUri)) ||
				(typeof data.value === 'string' &&
					(data.value.startsWith('file:') ||
						data.value.startsWith('content:'))))

		if (isLocalFile) {
			const fileUri =
				('contentUri' in data && data.contentUri) || data.value
			const fileName = data.originalName
			clearSharedPayloads()
			void handleIncomingFileUri(fileUri, fileName)
			return
		}

		let query: string | undefined
		if (data.shareType === 'text') {
			query = data.value
		} else if (data.shareType === 'url') {
			query =
				data.value ||
				('contentUri' in data ? data.contentUri ?? undefined : undefined)
		} else if ('contentType' in data && data.contentType === 'website') {
			query =
				('contentUri' in data ? data.contentUri ?? undefined : undefined) ||
				data.value
		} else if (
			typeof data.value === 'string' &&
			data.value.trim().length > 0
		) {
			query = data.value
		}

		if (!query) {
			clearSharedPayloads()
			return
		}

		clearSharedPayloads()
		const trimmed = query.trim()
		if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
			void handleIncomingJsonContent(trimmed)
			return
		}
		void handleEnter(query)
	}, [
		resolvedSharedPayloads,
		clearSharedPayloads,
		handleEnter,
		handleIncomingFileUri,
		handleIncomingJsonContent,
	])

	return (
		<KeyboardAvoidingView
			style={[styles.container, { backgroundColor: colors.background }]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<SkinAppbarBackground height={insets.top + 100} />
			{searchFocused && (
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={dismissPanel}
					accessibilityLabel='收起搜索建议'
					testID='search-panel-backdrop'
				/>
			)}
			<View
				pointerEvents='none'
				style={[styles.header, { paddingTop: insets.top + 8 }]}
			>
				<Text
					variant='headlineSmall'
					style={[styles.title, { color: headerForegroundColor }]}
				>
					搜索
				</Text>
			</View>
			<View
				pointerEvents='box-none'
				style={styles.searchbarContainer}
			>
				<Searchbar
					ref={searchBarRef}
					placeholder='关键词 / b23.tv / 视频链接 / av / BV'
					value={searchQuery}
					onChangeText={setSearchQuery}
					onSubmitEditing={() => void handleEnter(searchQuery)}
					onIconPress={() => void handleEnter(searchQuery)}
					onClearIconPress={() => setSearchQuery('')}
					onFocus={() => setSearchFocused(true)}
					onBlur={() => setSearchFocused(false)}
					loading={isLoading}
					editable={!isLoading}
					returnKeyType='search'
					elevation={0}
					mode='bar'
					style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
					testID='search-bar'
				/>
			</View>
			<View
				pointerEvents='box-none'
				style={[styles.content, { paddingBottom: contentBottomPadding }]}
				onLayout={({ nativeEvent }) =>
					setContentHeight(nativeEvent.layout.height)
				}
			>
				{isResolving ? (
					<ActivityIndicator style={styles.resolving} />
				) : (
					<>
						<SearchHistory
							searchHistory={searchHistory}
							onHistoryPress={handleSuggestionPress}
							onClearHistory={handleClearHistory}
							onRemoveHistoryItem={handleRemoveHistoryItem}
							onDismiss={dismissPanel}
							panelVisible={suggestionsVisible}
						/>
						<View
							pointerEvents='box-none'
							style={styles.suggestions}
						>
							<SearchSuggestions
								query={deferredSearchQuery}
								visible={suggestionsVisible}
								availableHeight={contentHeight - contentBottomPadding}
								onSuggestionPress={handleSuggestionPress}
							/>
						</View>
					</>
				)}
			</View>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	header: { paddingHorizontal: 16, paddingBottom: 16, minHeight: 56 },
	title: { fontWeight: 'bold' },
	searchbarContainer: { paddingHorizontal: 16, paddingBottom: 16 },
	searchbar: { borderRadius: 9999 },
	content: { flex: 1, paddingHorizontal: 16 },
	suggestions: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 1 },
	resolving: { flex: 1 },
})
