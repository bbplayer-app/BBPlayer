import FunctionalMenu from '@/components/common/FunctionalMenu'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import type { BilibiliTrack } from '@/types/core/media'
import type {
	ListRenderItemInfoWithExtraData,
	SelectionState,
} from '@/types/flashlist'
import * as Haptics from '@/utils/haptics'
import type {
	FlashListProps,
	FlashListRef,
	ListRenderItem,
} from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface TrackListProps
	extends Omit<
		FlashListProps<BilibiliTrack>,
		'data' | 'renderItem' | 'extraData'
	> {
	/**
	 * 要显示的曲目数据数组
	 */
	tracks: BilibiliTrack[]
	/**
	 * 点击曲目时的回调函数
	 */
	playTrack: (track: BilibiliTrack) => void
	/**
	 * 生成曲目菜单项的函数
	 */
	trackMenuItems: (
		track: BilibiliTrack,
	) => { title: string; leadingIcon: string; onPress: () => void }[]
	/**
	 * 多选状态管理
	 */
	selection: SelectionState
	/**
	 * 是否显示封面图片，默认为 true
	 */
	showItemCover?: boolean
	/**
	 * 是否正在获取下一页数据
	 */
	isFetchingNextPage?: boolean
	/**
	 * 是否还有下一页数据
	 */
	hasNextPage?: boolean
	/**
	 * 自定义渲染列表项的函数（可选）
	 */
	renderCustomItem?: (
		info: ListRenderItemInfoWithExtraData<BilibiliTrack, ExtraData>,
	) => React.ReactElement | null
	/**
	 * 列表引用（可选）
	 */
	listRef?: React.Ref<FlashListRef<BilibiliTrack>>
}

export interface ExtraData {
	playTrack: (track: BilibiliTrack) => void
	handleMenuPress: (
		track: BilibiliTrack,
		anchor: { x: number; y: number },
	) => void
	selection: SelectionState
	showItemCover?: boolean
	currentTrackIdRef: RefObject<string | undefined>
}

const renderItemDefault = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<BilibiliTrack, ExtraData>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const {
		playTrack,
		handleMenuPress,
		selection,
		showItemCover,
		currentTrackIdRef,
	} = extraData
	return (
		<TrackListItem
			index={index}
			onTrackPress={() => {
				if (item.uniqueKey === currentTrackIdRef.current) return
				playTrack(item)
			}}
			onMenuPress={(anchor) => handleMenuPress(item, anchor)}
			showCoverImage={showItemCover ?? true}
			data={{
				cover: item.coverUrl ?? undefined,
				title: item.title,
				duration: item.duration,
				id: item.id,
				artistName: item.artist?.name,
				uniqueKey: item.uniqueKey,
				titleHtml: item.titleHtml,
			}}
			toggleSelected={() => {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
				selection.toggle(item.id)
			}}
			isSelected={selection.selected.has(item.id)}
			selectMode={selection.active}
			enterSelectMode={() => {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
				selection.enter(item.id)
			}}
		/>
	)
}

export function TrackList({
	tracks,
	playTrack,
	trackMenuItems,
	selection,
	showItemCover,
	isFetchingNextPage,
	hasNextPage,
	renderCustomItem,
	listRef,
	...flashListProps
}: TrackListProps) {
	const { colors } = useTheme()
	const currentTrackId = useCurrentTrackId()
	const currentTrackIdRef = useRef(currentTrackId)

	useEffect(() => {
		currentTrackIdRef.current = currentTrackId
	}, [currentTrackId])
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

	const handleDismissMenu = useCallback(() => {
		setMenuState((prev) => ({ ...prev, visible: false }))
	}, [])

	const keyExtractor = useCallback((item: BilibiliTrack) => {
		return String(item.id)
	}, [])

	const handleMenuPress = useCallback(
		(track: BilibiliTrack, anchor: { x: number; y: number }) => {
			setMenuState({ visible: true, anchor, track })
		},
		[],
	)

	const extraData = useMemo(
		() => ({
			selection,
			playTrack,
			showItemCover,
			currentTrackIdRef,
			handleMenuPress,
		}),
		[selection, playTrack, showItemCover, handleMenuPress],
	)

	const renderItem = renderCustomItem ?? renderItemDefault

	return (
		<>
			<FlashList
				ref={listRef}
				data={tracks}
				extraData={extraData}
				renderItem={renderItem as ListRenderItem<BilibiliTrack>}
				ItemSeparatorComponent={() => <Divider />}
				keyExtractor={keyExtractor}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					// 实现一个在 menu 弹出时，列表不可触摸的效果
					pointerEvents: menuState.visible ? 'none' : 'auto',
					paddingBottom: currentTrackId ? 70 + insets.bottom : insets.bottom,
				}}
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
					) : null) ?? flashListProps.ListFooterComponent
				}
				ListEmptyComponent={
					flashListProps.ListEmptyComponent ?? (
						<Text
							style={[styles.emptyList, { color: colors.onSurfaceVariant }]}
						>
							什么都没找到哦~
						</Text>
					)
				}
				{...flashListProps}
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
