import { DownloadState, Orpheus, type DownloadTask } from '@bbplayer/orpheus'
import type { TrueSheet as TrueSheetType } from '@lodev09/react-native-true-sheet'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import {
	type ComponentRef,
	useCallback,
	useMemo,
	useRef,
	useState,
} from 'react'
import { StyleSheet, ToastAndroid, View, Platform, Alert } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import {
	ActivityIndicator,
	Appbar,
	Checkbox,
	Divider,
	Menu,
	Searchbar,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import FunctionalMenu from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import ExportDownloadsProgressModal from '@/components/modals/settings/ExportDownloadsProgressModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { useTrackSelection } from '@/features/playlist/local/hooks/useTrackSelection'
import { useRemoveDownloadsMutation } from '@/hooks/mutations/orpheus'
import { useAllDownloads, orpheusQueryKeys } from '@/hooks/queries/orpheus'
import { queryClient } from '@/lib/config/queryClient'
import {
	LIST_ITEM_COVER_SIZE,
	LIST_ITEM_BORDER_RADIUS,
} from '@/theme/dimensions'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

interface DownloadedItemExtraData {
	selectMode: boolean
	selected: Set<string>
	toggleSelected: (id: string) => void
	enterSelectMode: (id: string) => void
	onMenuPress: (id: string, anchor: { x: number; y: number }) => void
}

function renderDownloadedItem({
	item,
	index,
	extraData,
}: {
	item: DownloadTask
	index: number
	extraData?: DownloadedItemExtraData
}) {
	return (
		<DownloadedItem
			item={item}
			index={index}
			selectMode={extraData?.selectMode ?? false}
			isSelected={extraData?.selected.has(item.id) ?? false}
			toggleSelected={extraData?.toggleSelected ?? (() => {})}
			enterSelectMode={extraData?.enterSelectMode ?? (() => {})}
			onMenuPress={extraData?.onMenuPress ?? (() => {})}
		/>
	)
}

function DownloadedItem({
	item,
	index,
	selectMode,
	isSelected,
	toggleSelected,
	enterSelectMode,
	onMenuPress,
}: {
	item: DownloadTask
	index: number
	selectMode: boolean
	isSelected: boolean
	toggleSelected: (id: string) => void
	enterSelectMode: (id: string) => void
	onMenuPress: (id: string, anchor: { x: number; y: number }) => void
}) {
	const theme = useTheme()
	const track = item.track
	const menuButtonRef = useRef<ComponentRef<typeof IconButton>>(null)

	return (
		<RectButton
			style={[
				styles.rectButton,
				{
					backgroundColor: isSelected
						? theme.dark
							? 'rgba(255, 255, 255, 0.12)'
							: 'rgba(0, 0, 0, 0.12)'
						: 'transparent',
				},
			]}
			onPress={() => {
				if (selectMode) {
					toggleSelected(item.id)
				}
			}}
			onLongPress={() => {
				if (!selectMode) {
					enterSelectMode(item.id)
				}
			}}
		>
			<Surface
				style={styles.surface}
				elevation={0}
			>
				<View style={styles.itemContainer}>
					<View style={styles.indexContainer}>
						<View
							style={[
								styles.checkboxContainer,
								{ opacity: selectMode ? 1 : 0 },
							]}
						>
							<Checkbox status={isSelected ? 'checked' : 'unchecked'} />
						</View>
						<View style={{ opacity: selectMode ? 0 : 1 }}>
							<Text
								variant='bodyMedium'
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{index + 1}
							</Text>
						</View>
					</View>

					<CoverWithPlaceHolder
						id={item.id}
						cover={track?.artwork}
						title={track?.title ?? '未知曲目'}
						size={LIST_ITEM_COVER_SIZE}
					/>

					<View style={styles.titleContainer}>
						<Text
							variant='bodySmall'
							numberOfLines={1}
						>
							{track?.title ?? '未知曲目'}
						</Text>
						<View style={styles.detailsContainer}>
							{track?.artist && (
								<>
									<Text
										variant='bodySmall'
										numberOfLines={1}
									>
										{track.artist}
									</Text>
									<Text
										style={styles.dotSeparator}
										variant='bodySmall'
									>
										•
									</Text>
								</>
							)}
							<Text variant='bodySmall'>
								{track?.duration ? formatDurationToHHMMSS(track.duration) : ''}
							</Text>
						</View>
					</View>

					{!selectMode && (
						<IconButton
							ref={menuButtonRef}
							icon='dots-vertical'
							size={20}
							iconColor={theme.colors.onSurfaceVariant}
							onPress={() => {
								;(menuButtonRef.current as unknown as View)?.measure(
									(
										_x: number,
										_y: number,
										_w: number,
										_h: number,
										pageX: number,
										pageY: number,
									) => {
										onMenuPress(item.id, { x: pageX, y: pageY })
									},
								)
							}}
						/>
					)}
				</View>
			</Surface>
		</RectButton>
	)
}

export default function DownloadedPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const exportSheetRef = useRef<TrueSheetType>(null)
	const [exportConfig, setExportConfig] = useState<{
		ids: string[]
		destinationUri: string
	} | null>(null)

	const { data: allTasks, isPending } = useAllDownloads()
	const completedTasks = (allTasks ?? []).filter(
		(t) => t.state === DownloadState.COMPLETED,
	)

	const [searchQuery, setSearchQuery] = useState('')
	const [isSearching, setIsSearching] = useState(false)

	const filteredTasks = (() => {
		if (!searchQuery.trim()) return completedTasks
		const query = searchQuery.toLowerCase()
		return completedTasks.filter((t) => {
			const track = t.track
			return (
				track?.title?.toLowerCase().includes(query) ||
				track?.artist?.toLowerCase().includes(query)
			)
		})
	})()

	const {
		selected,
		selectMode,
		toggle,
		enterSelectMode,
		exitSelectMode,
		setSelected,
	} = useTrackSelection<string>()

	const removeDownloadsMutation = useRemoveDownloadsMutation()

	const [menuState, setMenuState] = useState<{
		visible: boolean
		id: string | null
		anchor: { x: number; y: number }
	}>({ visible: false, id: null, anchor: { x: 0, y: 0 } })

	const handleItemMenuPress = useCallback(
		(id: string, anchor: { x: number; y: number }) => {
			setMenuState({ visible: true, id, anchor })
		},
		[],
	)

	const dismissItemMenu = useCallback(() => {
		setMenuState((prev) => ({ ...prev, visible: false }))
	}, [])

	const handleSingleExport = useCallback(async () => {
		dismissItemMenu()
		const id = menuState.id
		if (!id) return

		if (Platform.OS !== 'android') {
			Alert.alert('提示', '音频导出功能目前仅支持 Android 系统')
			return
		}

		ToastAndroid.showWithGravity(
			'请选择需要导出到的目录',
			ToastAndroid.SHORT,
			ToastAndroid.BOTTOM,
		)
		const directoryUri = await Orpheus.selectDirectory()
		if (directoryUri) {
			setExportConfig({ ids: [id], destinationUri: directoryUri })
			void exportSheetRef.current?.present()
		}
	}, [dismissItemMenu, menuState.id])

	const handleDelete = useCallback(() => {
		dismissItemMenu()
		const id = menuState.id
		if (!id) return
		const task = completedTasks.find((t) => t.id === id)
		const title = task?.track?.title ?? id
		alert(
			'删除下载',
			`确定要删除「${title}」的下载记录及缓存文件吗？`,
			[
				{ text: '取消' },
				{
					text: '删除',
					onPress: async () => {
						try {
							await Orpheus.removeDownload(id)
							await queryClient.invalidateQueries({
								queryKey: [...orpheusQueryKeys.all, 'allDownloads'],
							})
						} catch (e) {
							toastAndLogError('删除下载失败', e, 'Downloaded.Page')
						}
					},
				},
			],
			{ cancelable: true },
		)
	}, [dismissItemMenu, menuState.id, completedTasks])

	const handleExport = async () => {
		const idsToExport =
			selected.size > 0 ? Array.from(selected) : completedTasks.map((t) => t.id)

		if (idsToExport.length === 0) {
			if (Platform.OS === 'android') {
				ToastAndroid.showWithGravity(
					'没有可导出的歌曲',
					ToastAndroid.SHORT,
					ToastAndroid.BOTTOM,
				)
			} else {
				Alert.alert('提示', '没有可导出的歌曲')
			}
			return
		}

		if (Platform.OS !== 'android') {
			Alert.alert('提示', '音频导出功能目前仅支持 Android 系统')
			return
		}

		ToastAndroid.showWithGravity(
			'请选择需要导出到的目录',
			ToastAndroid.SHORT,
			ToastAndroid.BOTTOM,
		)
		const directoryUri = await Orpheus.selectDirectory()
		if (directoryUri) {
			setExportConfig({ ids: idsToExport, destinationUri: directoryUri })
			void exportSheetRef.current?.present()
			if (selectMode) {
				exitSelectMode()
			}
		}
	}

	const handleBatchDelete = useCallback(() => {
		const idsToDelete = Array.from(selected)
		if (idsToDelete.length === 0) return
		alert(
			'批量删除',
			`确定要删除选中的 ${idsToDelete.length} 首歌曲的下载记录及缓存文件吗？`,
			[
				{ text: '取消' },
				{
					text: '删除',
					onPress: () => {
						removeDownloadsMutation.mutate(idsToDelete, {
							onSuccess: () => exitSelectMode(),
							onError: (e) =>
								toastAndLogError('批量删除失败', e, 'Downloaded.Page'),
						})
					},
				},
			],
			{ cancelable: true },
		)
	}, [selected, exitSelectMode, removeDownloadsMutation])

	const invertSelection = useCallback(() => {
		const allIds = filteredTasks.map((t) => t.id)
		const inverted = new Set(allIds.filter((id) => !selected.has(id)))
		setSelected(inverted)
		void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
	}, [filteredTasks, selected, setSelected])

	const extraData = useMemo<DownloadedItemExtraData>(
		() => ({
			selectMode,
			selected,
			toggleSelected: (id: string) => {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
				toggle(id)
			},
			enterSelectMode: (id: string) => {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
				enterSelectMode(id)
			},
			onMenuPress: handleItemMenuPress,
		}),
		[selectMode, selected, toggle, enterSelectMode, handleItemMenuPress],
	)

	if (isPending) {
		return (
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				<ActivityIndicator
					size='large'
					color={colors.primary}
					style={{ flex: 1 }}
				/>
			</View>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction
					onPress={() => (selectMode ? exitSelectMode() : router.back())}
				/>
				<Appbar.Content
					title={selectMode ? `已选择 ${selected.size} 项` : '下载管理'}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							icon='select-all'
							onPress={() =>
								setSelected(new Set(filteredTasks.map((t) => t.id)))
							}
						/>
						<Appbar.Action
							icon='select-compare'
							onPress={invertSelection}
						/>
						<Appbar.Action
							icon='trash-can-outline'
							onPress={handleBatchDelete}
							disabled={selected.size === 0}
						/>
						<Appbar.Action
							icon='export-variant'
							onPress={handleExport}
							disabled={selected.size === 0}
						/>
					</>
				) : (
					<>
						<Appbar.Action
							icon='magnify'
							onPress={() => setIsSearching(!isSearching)}
						/>
						<Appbar.Action
							icon='progress-download'
							onPress={() => router.push('/download')}
						/>
						<Appbar.Action
							icon='export-variant'
							onPress={handleExport}
							disabled={completedTasks.length === 0}
						/>
					</>
				)}
			</Appbar.Header>

			{isSearching && !selectMode && (
				<Searchbar
					placeholder='搜索已下载歌曲'
					onChangeText={setSearchQuery}
					value={searchQuery}
					style={styles.searchbar}
					onIconPress={() => setIsSearching(false)}
				/>
			)}

			<View style={styles.listContainer}>
				<FlashList
					data={filteredTasks}
					renderItem={renderDownloadedItem}
					extraData={extraData}
					keyExtractor={(item) => item.id}
					ItemSeparatorComponent={() => <Divider />}
					contentContainerStyle={{
						paddingBottom: insets.bottom + 70,
					}}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text variant='bodyLarge'>没有已下载的歌曲</Text>
						</View>
					}
				/>
			</View>

			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>

			<FunctionalMenu
				visible={menuState.visible}
				onDismiss={dismissItemMenu}
				anchor={menuState.anchor}
				anchorPosition='bottom'
			>
				<Menu.Item
					leadingIcon='export-variant'
					title='导出'
					onPress={() => {
						void handleSingleExport()
					}}
				/>
				<Menu.Item
					leadingIcon='trash-can-outline'
					title='删除'
					onPress={handleDelete}
				/>
			</FunctionalMenu>

			<ExportDownloadsProgressModal
				sheetRef={exportSheetRef}
				ids={exportConfig?.ids ?? []}
				destinationUri={exportConfig?.destinationUri ?? ''}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	listContainer: { flex: 1 },
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
	searchbar: {
		margin: 8,
		elevation: 0,
		backgroundColor: 'transparent',
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0,0,0,0.1)',
	},
	rectButton: { paddingVertical: 4 },
	surface: {
		overflow: 'hidden',
		borderRadius: LIST_ITEM_BORDER_RADIUS,
		backgroundColor: 'transparent',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	indexContainer: {
		width: 35,
		marginRight: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	checkboxContainer: { position: 'absolute' },
	titleContainer: { marginLeft: 12, flex: 1, marginRight: 4 },
	detailsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
	},
	dotSeparator: { marginHorizontal: 4 },
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 100,
	},
})
