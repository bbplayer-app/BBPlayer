import { DownloadState, Orpheus, type DownloadTask } from '@bbplayer/orpheus'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import {
	ActivityIndicator,
	Appbar,
	Checkbox,
	Divider,
	Searchbar,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import NowPlayingBar from '@/components/NowPlayingBar'
import { useTrackSelection } from '@/features/playlist/local/hooks/useTrackSelection'
import { useAllDownloads } from '@/hooks/queries/orpheus'
import { useModalStore } from '@/hooks/stores/useModalStore'
import {
	LIST_ITEM_COVER_SIZE,
	LIST_ITEM_BORDER_RADIUS,
} from '@/theme/dimensions'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

function DownloadedItem({
	item,
	index,
	selectMode,
	isSelected,
	toggleSelected,
	enterSelectMode,
}: {
	item: DownloadTask
	index: number
	selectMode: boolean
	isSelected: boolean
	toggleSelected: (id: string) => void
	enterSelectMode: (id: string) => void
}) {
	const theme = useTheme()
	const track = item.track

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
				</View>
			</Surface>
		</RectButton>
	)
}

export default function DownloadedPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)

	const { data: allTasks, isPending } = useAllDownloads()
	const completedTasks = useMemo(
		() => (allTasks ?? []).filter((t) => t.state === DownloadState.COMPLETED),
		[allTasks],
	)

	const [searchQuery, setSearchQuery] = useState('')
	const [isSearching, setIsSearching] = useState(false)

	const filteredTasks = useMemo(() => {
		if (!searchQuery.trim()) return completedTasks
		const query = searchQuery.toLowerCase()
		return completedTasks.filter((t) => {
			const track = t.track
			return (
				track?.title?.toLowerCase().includes(query) ||
				track?.artist?.toLowerCase().includes(query)
			)
		})
	}, [completedTasks, searchQuery])

	const {
		selected,
		selectMode,
		toggle,
		enterSelectMode,
		exitSelectMode,
		setSelected,
	} = useTrackSelection<string>()

	const handleExport = async () => {
		const idsToExport = selectMode
			? Array.from(selected)
			: completedTasks.map((t) => t.id)
		if (idsToExport.length === 0) return

		const directoryUri = await Orpheus.selectDirectory()
		if (directoryUri) {
			openModal('ExportDownloadsProgress', {
				ids: idsToExport,
				destinationUri: directoryUri,
			})
			exitSelectMode()
		}
	}

	const renderDownloadedItem = useCallback(
		({ item, index }: { item: DownloadTask; index: number }) => (
			<DownloadedItem
				item={item}
				index={index}
				selectMode={selectMode}
				isSelected={selected.has(item.id)}
				toggleSelected={(id) => {
					void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
					toggle(id)
				}}
				enterSelectMode={(id) => {
					void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
					enterSelectMode(id)
				}}
			/>
		),
		[selectMode, selected, toggle, enterSelectMode],
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
					title={selectMode ? `已选择 ${selected.size} 项` : '下载历史'}
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
