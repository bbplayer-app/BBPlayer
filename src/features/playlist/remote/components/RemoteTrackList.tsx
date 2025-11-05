import type React from 'react'
import FunctionalMenu from '@/components/common/FunctionalMenu'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import type { BilibiliTrack } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import * as Haptics from '@/utils/haptics'
import type { ListRenderItem } from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Divider,
	Menu,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TrackListItem } from './PlaylistItem'

interface TrackListProps {
	tracks: BilibiliTrack[]
	playTrack: (track: BilibiliTrack) => void
	trackMenuItems: (
		track: BilibiliTrack,
	) => { title: string; leadingIcon: string; onPress: () => void }[]
	selectMode: boolean
	selected: Set<number>
	toggle: (id: number) => void
	enterSelectMode: (id: number) => void
	ListHeaderComponent: Parameters<typeof FlashList>[0]['ListHeaderComponent']
	ListFooterComponent?: Parameters<typeof FlashList>[0]['ListFooterComponent']
	ListEmptyComponent?: Parameters<typeof FlashList>[0]['ListEmptyComponent']
	refreshControl: Parameters<typeof FlashList>[0]['refreshControl']
	onEndReached?: () => void
	showItemCover?: boolean
	isFetchingNextPage?: boolean
	hasNextPage?: boolean
	renderCustomItem?: (info: ListRenderItemInfoWithExtraData<BilibiliTrack, ExtraData>) => React.ReactElement | null
}

export interface ExtraData {
	toggle: (id: number) => void
	playTrack: (track: BilibiliTrack) => void
	handleMenuPress: (
		track: BilibiliTrack,
		anchor: { x: number; y: number },
	) => void
	selected: Set<number>
	selectMode: boolean
	enterSelectMode: (id: number) => void
	showItemCover?: boolean
}

const renderItemDefault = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<BilibiliTrack, ExtraData>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const {
		toggle,
		playTrack,
		handleMenuPress,
		selected,
		selectMode,
		enterSelectMode,
		showItemCover,
	} = extraData
	return (
		<TrackListItem
			index={index}
			onTrackPress={() => playTrack(item)}
			onMenuPress={(anchor) => handleMenuPress(item, anchor)}
			showCoverImage={showItemCover ?? true}
			data={{
				cover: item.coverUrl ?? undefined,
				title: item.title,
				duration: item.duration,
				id: item.id,
				artistName: item.artist?.name,
				uniqueKey: item.uniqueKey,
			}}
			toggleSelected={() => {
				void Haptics.performAndroidHapticsAsync(
					Haptics.AndroidHaptics.Clock_Tick,
				)
				toggle(item.id)
			}}
			isSelected={selected.has(item.id)}
			selectMode={selectMode}
			enterSelectMode={() => {
				void Haptics.performAndroidHapticsAsync(
					Haptics.AndroidHaptics.Long_Press,
				)
				enterSelectMode(item.id)
			}}
		/>
	)
}

export function TrackList({
	tracks,
	playTrack,
	trackMenuItems,
	selectMode,
	selected,
	toggle,
	enterSelectMode,
	ListHeaderComponent,
	ListFooterComponent,
	ListEmptyComponent,
	refreshControl,
	onEndReached,
	showItemCover,
	isFetchingNextPage,
	hasNextPage,
	renderCustomItem,
}: TrackListProps) {
	const { colors } = useTheme()
	const haveTrack = usePlayerStore((state) => !!state.currentTrackUniqueKey)
	const insets = useSafeAreaInsets()

	const [menuState, setMenuState] = useState<{
		visible: boolean
		anchor: { x: number; y: number }
		track: BilibiliTrack | null
	}>({
		visible: false,
		anchor: { x: 0, y: 0 },
		track: null,
	})

	const handleMenuPress = useCallback(
		(track: BilibiliTrack, anchor: { x: number; y: number }) => {
			setMenuState({ visible: true, anchor, track })
		},
		[],
	)

	const handleDismissMenu = useCallback(() => {
		setMenuState((prev) => ({ ...prev, visible: false }))
	}, [])

	const keyExtractor = useCallback((item: BilibiliTrack) => {
		return String(item.id)
	}, [])

	const extraData = useMemo(
		() => ({
			selectMode,
			selected,
			toggle,
			playTrack,
			handleMenuPress,
			enterSelectMode,
			showItemCover,
		}),
		[
			selectMode,
			selected,
			toggle,
			playTrack,
			handleMenuPress,
			enterSelectMode,
			showItemCover,
		],
	)

	const renderItem = renderCustomItem ?? renderItemDefault

	return (
		<>
			<FlashList
				data={tracks}
				extraData={extraData}
				renderItem={renderItem as ListRenderItem<BilibiliTrack>}
				ItemSeparatorComponent={() => <Divider />}
				ListHeaderComponent={ListHeaderComponent}
				refreshControl={refreshControl}
				keyExtractor={keyExtractor}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					// 实现一个在 menu 弹出时，列表不可触摸的效果
					pointerEvents: menuState.visible ? 'none' : 'auto',
					paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
				}}
				onEndReached={onEndReached}
				ListFooterComponent={
					(isFetchingNextPage ? (
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
					) : null) ?? ListFooterComponent
				}
				ListEmptyComponent={
					ListEmptyComponent ?? (
						<Text
							style={[styles.emptyList, { color: colors.onSurfaceVariant }]}
						>
							什么都没找到哦~
						</Text>
					)
				}
			/>
			{menuState.track && (
				<FunctionalMenu
					visible={menuState.visible}
					onDismiss={handleDismissMenu}
					anchor={menuState.anchor}
					anchorPosition='bottom'
				>
					{trackMenuItems(menuState.track).map((item) => (
						<Menu.Item
							key={item.title}
							leadingIcon={item.leadingIcon}
							onPress={() => {
								item.onPress()
								handleDismissMenu()
							}}
							title={item.title}
						/>
					))}
				</FunctionalMenu>
			)}
		</>
	)
}

const styles = StyleSheet.create({
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
	emptyList: {
		paddingVertical: 32,
		textAlign: 'center',
	},
})