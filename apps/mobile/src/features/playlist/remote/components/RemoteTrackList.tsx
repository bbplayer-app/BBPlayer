import type {
	FlashListProps,
	FlashListRef,
	ListRenderItem,
} from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Divider, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import type { BilibiliTrack } from '@/types/core/media'
import type {
	ListRenderItemInfoWithExtraData,
	SelectionState,
} from '@/types/flashlist'
import * as Haptics from '@/utils/haptics'

import { TrackListItem, type TrackMenuItem } from './PlaylistItem'

interface TrackListProps extends Omit<
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
	trackMenuItems: (track: BilibiliTrack) => TrackMenuItem[]
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
	trackMenuItems: (track: BilibiliTrack) => TrackMenuItem[]
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
		trackMenuItems,
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
			menuItems={trackMenuItems(item)}
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

	const keyExtractor = useCallback((item: BilibiliTrack) => {
		return String(item.id)
	}, [])

	const extraData = useMemo(
		() => ({
			selection,
			playTrack,
			showItemCover,
			currentTrackIdRef,
			trackMenuItems,
		}),
		[selection, playTrack, showItemCover, trackMenuItems],
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
