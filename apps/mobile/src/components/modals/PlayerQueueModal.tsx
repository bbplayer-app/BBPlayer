import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Orpheus } from '@bbplayer/orpheus'
import type { LegendListRef } from '@legendapp/list/react-native'
import { LegendList } from '@legendapp/list/react-native'
import { ModalBottomSheet } from '@swmansion/react-native-bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Surface, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import useCurrentTrackIdHook from '@/hooks/player/useCurrentTrackId'
import { useIsCurrentTrack } from '@/hooks/player/useIsCurrentTrack'
import { useShuffleMode } from '@/hooks/queries/orpheus'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import { analyticsService } from '@/lib/services/analyticsService'
import * as Haptics from '@/utils/haptics'

const TrackItem = memo(
	({
		track,
		onSwitchTrack,
		onRemoveTrack,
		index,
	}: {
		track: OrpheusTrack
		onSwitchTrack: (index: number) => void
		onRemoveTrack: (index: number) => void
		index: number
	}) => {
		const colors = useTheme().colors
		const isCurrentTrack = useIsCurrentTrack(track.id)
		return (
			<Surface
				style={{
					backgroundColor: isCurrentTrack ? colors.elevation.level5 : undefined,
					overflow: 'hidden',
					borderRadius: 8,
					minHeight: 56, // Enforce min height for visual consistency
				}}
				elevation={0}
			>
				<Touchable
					androidRipple={{}}
					onPress={() => onSwitchTrack(index)}
				>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'space-between',
							padding: 8,
							flex: 1,
						}}
					>
						<View
							style={{
								paddingRight: 0,
								flex: 1,
								marginLeft: 12,
								flexDirection: 'column',
							}}
						>
							<Text
								variant='bodyMedium'
								numberOfLines={1}
								style={{ fontWeight: 'bold' }}
							>
								{track.title}
							</Text>
							<Text
								variant='bodySmall'
								style={{ fontWeight: 'thin' }}
								numberOfLines={1}
							>
								{track.artist ?? '未知作者'}
							</Text>
						</View>
						<IconButton
							icon='close-circle-outline'
							size={24}
							onPress={() => {
								onRemoveTrack(index)
							}}
						/>
					</View>
				</Touchable>
			</Surface>
		)
	},
)

TrackItem.displayName = 'TrackItem'

function PlayerQueueModal() {
	const currentTrackId = useCurrentTrackIdHook()
	const theme = useTheme()
	const { height: windowHeight } = useWindowDimensions()
	const flatListRef = useRef<LegendListRef>(null)
	const didInitialScrollRef = useRef(false)
	const [isCurrentTrackVisible, setIsCurrentTrackVisible] = useState(true)
	const sheetIndex = usePlayerQueueSheetStore((state) => state.index)
	const setSheetIndex = usePlayerQueueSheetStore((state) => state.setIndex)

	const queue = usePlayerQueueStore((state) => state.tracks)
	const { data: shuffleMode } = useShuffleMode()

	const currentIndex = useMemo(() => {
		if (!currentTrackId) return -1
		return queue.findIndex((t) => t.id === currentTrackId)
	}, [currentTrackId, queue])

	const insets = useSafeAreaInsets()

	const switchTrackHandler = useCallback(
		async (index: number) => {
			if (index === -1) return
			const target = queue[index]
			if (!target) return
			if (target.id === currentTrackId) return
			await Orpheus.skipTo(index)
		},
		[queue, currentTrackId],
	)

	const removeTrackHandler = useCallback(async (index: number) => {
		await Orpheus.removeTrack(index)
	}, [])

	const reverseRemainingQueueHandler = useCallback(async () => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
		await Orpheus.reverseRemainingQueue()
		void analyticsService.logPlayerQueueAction('reverse_remaining')
	}, [])

	const keyExtractor = useCallback((item: OrpheusTrack) => item.id, [])

	const renderItem = useCallback(
		({ item, index }: { item: OrpheusTrack; index: number }) => (
			<TrackItem
				track={item}
				onSwitchTrack={switchTrackHandler}
				onRemoveTrack={removeTrackHandler}
				index={index}
			/>
		),
		[removeTrackHandler, switchTrackHandler],
	)

	const scrollToCurrent = useCallback(
		({ animated, force = false }: { animated: boolean; force?: boolean }) => {
			if (
				currentIndex === -1 ||
				!queue.length ||
				(!force && didInitialScrollRef.current)
			) {
				return
			}
			void flatListRef.current?.scrollToIndex({
				animated,
				index: currentIndex,
				viewPosition: 0.5,
			})
			didInitialScrollRef.current = true
		},
		[currentIndex, queue.length],
	)

	const handleViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: { item: OrpheusTrack }[] }) => {
			setIsCurrentTrackVisible(
				currentIndex === -1 ||
					viewableItems.some(({ item }) => item.id === currentTrackId),
			)
		},
		[currentIndex, currentTrackId],
	)

	const handleScrollToCurrent = useCallback(() => {
		setIsCurrentTrackVisible(true)
		scrollToCurrent({ animated: true, force: true })
	}, [scrollToCurrent])

	useEffect(() => {
		if (currentIndex === -1) {
			setIsCurrentTrackVisible(true)
		}
	}, [currentIndex])

	useEffect(() => {
		if (sheetIndex === 0) {
			didInitialScrollRef.current = false
			return
		}
		scrollToCurrent({ animated: false })
	}, [scrollToCurrent, sheetIndex])

	return (
		<ModalBottomSheet
			detents={[0, windowHeight * 0.75, windowHeight]}
			index={sheetIndex}
			onIndexChange={setSheetIndex}
			scrimColor='rgba(0, 0, 0, 0.5)'
			surface={
				<View
					style={{
						position: 'absolute',
						top: 0,
						right: 0,
						bottom: 0,
						left: 0,
						backgroundColor: theme.colors.elevation.level1,
					}}
				/>
			}
		>
			<View style={{ flex: 1 }}>
				<View
					style={{
						height: '100%',
					}}
				>
					<View
						style={{
							flexDirection: 'row',
							justifyContent: 'space-between',
							alignItems: 'center',
							paddingHorizontal: 16,
							paddingTop: 8,
							borderBottomWidth: 1,
							borderBottomColor: theme.colors.elevation.level2,
						}}
					>
						<Text variant='titleMedium'>播放队列 ({queue.length})</Text>
						<View style={{ flexDirection: 'row' }}>
							<IconButton
								icon='sort-reverse-variant'
								onPress={() => {
									void reverseRemainingQueueHandler()
								}}
								disabled={
									queue.length === 0 ||
									currentIndex === -1 ||
									shuffleMode !== false
								}
								testID='player-queue-reverse-remaining'
							/>
							<IconButton
								icon='content-save-outline'
								onPress={() => {
									if (queue.length > 0) {
										useModalStore.getState().open('SaveQueueToPlaylist', {
											trackIds: queue.map((t) => t.id),
										})
									}
								}}
								disabled={queue.length === 0}
							/>
						</View>
					</View>
					<View style={{ flex: 1, minHeight: 2 }}>
						<LegendList
							ref={flatListRef}
							data={queue}
							renderItem={renderItem}
							keyExtractor={keyExtractor}
							recycleItems
							contentContainerStyle={{
								paddingBottom: insets.bottom + 20,
							}}
							showsVerticalScrollIndicator={false}
							nestedScrollEnabled
							onViewableItemsChanged={handleViewableItemsChanged}
							viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
						/>
						{currentIndex !== -1 && !isCurrentTrackVisible && (
							<View
								style={{
									position: 'absolute',
									right: 16,
									bottom: insets.bottom + 16,
								}}
							>
								<IconButton
									icon='crosshairs-gps'
									mode='contained'
									size={32}
									onPress={handleScrollToCurrent}
									testID='player-queue-scroll-to-current'
								/>
							</View>
						)}
					</View>
				</View>
			</View>
		</ModalBottomSheet>
	)
}

export default PlayerQueueModal
