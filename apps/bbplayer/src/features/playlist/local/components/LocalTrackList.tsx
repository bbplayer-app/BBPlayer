import { TrueSheet } from '@lodev09/react-native-true-sheet'
import type { DownloadState } from '@roitium/expo-orpheus'
import type { FlashListProps, FlashListRef } from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import type { RefObject } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Divider,
	Icon,
	List,
	Surface,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBatchDownloadStatus } from '@/hooks/player/useBatchDownloadStatus'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import type { Playlist, Track } from '@/types/core/media'
import type {
	ListRenderItemInfoWithExtraData,
	SelectionState,
} from '@/types/flashlist'
import * as Haptics from '@/utils/haptics'

import type { TrackMenuItem } from './LocalPlaylistItem'
import { TrackListItem } from './LocalPlaylistItem'

interface LocalTrackListProps extends Omit<
	FlashListProps<Track>,
	'data' | 'renderItem' | 'extraData'
> {
	/**
	 * 要显示的本地曲目数组
	 */
	tracks: Track[]
	/**
	 * 所属的播放列表信息
	 */
	playlist: Playlist
	/**
	 * 点击曲目时的处理函数
	 */
	handleTrackPress: (track: Track) => void
	/**
	 * 生成曲目菜单项的函数
	 */
	trackMenuItems: (
		track: Track,
		downloadState?: DownloadState,
	) => TrackMenuItem[]
	/**
	 * 多选状态管理
	 */
	selection: SelectionState
	/**
	 * 列表引用
	 */
	listRef?: RefObject<FlashListRef<Track> | null>
	/**
	 * 是否还有下一页数据（可选）
	 */
	hasNextPage?: boolean
	/**
	 * 是否正在获取下一页数据（可选）
	 */
	isFetchingNextPage?: boolean
	/**
	 * 数据是否已过期，如果为 true，列表项会显示半透明（可选）
	 */
	isStale?: boolean
}

const renderItem = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<
	Track,
	{
		handleTrackPress: (track: Track) => void
		handleMenuPress: (track: Track, downloadState?: DownloadState) => void
		selection: SelectionState
		playlist: Playlist
		downloadStatus: Record<string, DownloadState>
		isStale?: boolean
	}
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const {
		handleTrackPress,
		handleMenuPress,
		selection,
		playlist,
		downloadStatus,
		isStale,
	} = extraData
	const downloadState = downloadStatus
		? downloadStatus[item.uniqueKey]
		: undefined
	return (
		<View style={{ opacity: isStale ? 0.5 : 1 }}>
			<TrackListItem
				index={index}
				onTrackPress={() => handleTrackPress(item)}
				onMenuPress={() => {
					handleMenuPress(item, downloadState)
				}}
				disabled={
					item.source === 'bilibili' && !item.bilibiliMetadata.videoIsValid
				}
				data={item}
				playlist={playlist}
				toggleSelected={(id: number) => {
					void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
					selection.toggle(id)
				}}
				isSelected={selection.selected.has(item.id)}
				selectMode={selection.active}
				enterSelectMode={(id: number) => {
					void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
					selection.enter(id)
				}}
				downloadState={downloadState}
			/>
		</View>
	)
}

const HighFreqButton = ({
	item,
	onDismiss,
}: {
	item: TrackMenuItem
	onDismiss: () => void
}) => {
	const theme = useTheme()

	return (
		<Surface
			style={{
				borderRadius: 16,
				overflow: 'hidden',
				backgroundColor: theme.colors.elevation.level2,
				flex: 1,
				marginHorizontal: 4,
			}}
			elevation={0}
		>
			<TouchableRipple
				onPress={() => {
					onDismiss()
					item.onPress()
				}}
				style={{ flex: 1 }}
			>
				<View
					style={{
						alignItems: 'center',
						justifyContent: 'center',
						paddingVertical: 16,
						height: 80,
					}}
				>
					<Icon
						source={item.leadingIcon}
						size={28}
					/>
					<Text
						variant='labelMedium'
						style={{ marginTop: 8 }}
						numberOfLines={1}
					>
						{item.title}
					</Text>
				</View>
			</TouchableRipple>
		</Surface>
	)
}

export function LocalTrackList({
	tracks,
	playlist,
	handleTrackPress,
	trackMenuItems,
	selection,
	ListHeaderComponent,
	onEndReached,
	isFetchingNextPage,
	hasNextPage,
	isStale,
	listRef,
	...flashListProps
}: LocalTrackListProps) {
	const haveTrack = useCurrentTrack()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const ids = tracks.map((t) => t.uniqueKey)
	const { data: downloadStatus } = useBatchDownloadStatus(ids)
	const sheetRef = useRef<TrueSheet>(null)

	const [menuState, setMenuState] = useState<{
		visible: boolean
		track: Track | null
		downloadState?: DownloadState
	}>({
		visible: false,
		track: null,
		downloadState: undefined,
	})

	const handleMenuPress = useCallback(
		(track: Track, downloadState?: DownloadState) => {
			setMenuState({ visible: true, track, downloadState })
			sheetRef.current?.present().catch(() => {
				setMenuState((prev) => ({ ...prev, visible: false }))
			})
		},
		[],
	)

	const dismissMenu = useCallback(() => {
		sheetRef.current?.dismiss().catch(() => {
			// ignore error
		})
	}, [])

	const { highFreqItems, normalItems } = (() => {
		if (!menuState.track) return { highFreqItems: [], normalItems: [] }
		const allItems = trackMenuItems(menuState.track, menuState.downloadState)
		return {
			highFreqItems: allItems.filter((i) => i.isHighFreq),
			normalItems: allItems.filter((i) => !i.isHighFreq),
		}
	})()

	const keyExtractor = useCallback((item: Track) => String(item.id), [])

	const extraData = useMemo(
		() => ({
			selection,
			handleTrackPress,
			handleMenuPress,
			playlist,
			downloadStatus,
			isStale,
		}),
		[
			selection,
			handleTrackPress,
			handleMenuPress,
			playlist,
			downloadStatus,
			isStale,
		],
	)

	usePreventRemove(menuState.visible, () => {
		setMenuState({ visible: false, track: null, downloadState: undefined })
		sheetRef.current?.dismiss().catch(() => {
			// ignore error
		})
	})

	return (
		<>
			<FlashList
				ref={listRef}
				data={tracks}
				renderItem={renderItem}
				extraData={extraData}
				ItemSeparatorComponent={() => <Divider />}
				ListHeaderComponent={ListHeaderComponent}
				keyExtractor={keyExtractor}
				contentContainerStyle={{
					pointerEvents: menuState.visible ? 'none' : 'auto',
					paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
				}}
				showsVerticalScrollIndicator={false}
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
				onEndReached={onEndReached}
				onEndReachedThreshold={0.8}
				{...flashListProps}
			/>
			<TrueSheet
				ref={sheetRef}
				detents={['auto']}
				cornerRadius={24}
				backgroundColor={theme.colors.elevation.level1}
				onDidDismiss={() => {
					setMenuState((prev) => ({ ...prev, visible: false }))
				}}
			>
				<ScrollView
					style={{ maxHeight: '100%', marginTop: 32 }}
					contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
				>
					{menuState.track && (
						<>
							<View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
								<Text
									variant='titleMedium'
									numberOfLines={1}
								>
									{menuState.track.title}
								</Text>
								<Text
									variant='bodySmall'
									style={{ opacity: 0.6 }}
									numberOfLines={1}
								>
									{menuState.track.artist?.name ?? '未知艺术家'}
								</Text>
								<Divider style={{ marginTop: 12 }} />
								{highFreqItems.length > 0 && (
									<View
										style={{
											flexDirection: 'row',
											paddingBottom: 12,
											paddingTop: 16,
											width: '100%',
										}}
									>
										{highFreqItems.map((item, index) => (
											<HighFreqButton
												key={index}
												item={item}
												onDismiss={dismissMenu}
											/>
										))}
									</View>
								)}
							</View>

							{normalItems.map((menuItem, index) => (
								<List.Item
									key={index}
									title={menuItem.title}
									titleStyle={
										menuItem.danger ? { color: theme.colors.error } : {}
									}
									left={(props) =>
										menuItem.leadingIcon ? (
											<List.Icon
												{...props}
												icon={menuItem.leadingIcon}
												color={
													menuItem.danger
														? theme.colors.error
														: theme.colors.onSurface
												}
											/>
										) : null
									}
									onPress={() => {
										dismissMenu()
										menuItem.onPress()
									}}
								/>
							))}
						</>
					)}
				</ScrollView>
			</TrueSheet>
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
})
