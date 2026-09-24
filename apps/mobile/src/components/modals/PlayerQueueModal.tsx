import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Orpheus } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
import type { LegendListRef } from '@legendapp/list/react-native'
import { LegendList } from '@legendapp/list/react-native'
import {
	TrueSheet,
	type TrueSheetProps,
} from '@lodev09/react-native-true-sheet'
import Color from 'color'
import type { RefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import {
	GestureDetector,
	GestureHandlerRootView,
	Touchable,
	usePanGesture,
} from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrackIdHook from '@/hooks/player/useCurrentTrackId'
import { useIsCurrentTrack } from '@/hooks/player/useIsCurrentTrack'
import { useShuffleMode } from '@/hooks/queries/orpheus'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import { useDeferredSheetAction } from '@/hooks/ui/useDeferredSheetAction'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import { clearPlaybackQueue } from '@/lib/player/playbackSession'
import { analyticsService } from '@/lib/services/analyticsService'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'

const CLEAR_QUEUE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const REVERSE_QUEUE_ICON = Icon.select({
	ios: 'arrow.up.arrow.down',
	android: import('@expo/material-symbols/swap_vert.xml'),
})

const SAVE_QUEUE_ICON = Icon.select({
	ios: 'square.and.arrow.down',
	android: import('@expo/material-symbols/save.xml'),
})

const ROW_HEIGHT = 64
const EDGE_ZONE = 64
const SCROLL_STEP = 8

const TrackItem = memo(
	({
		track,
		onSwitchTrack,
		onRemoveTrack,
		onDragStart,
		onDragUpdate,
		onDragEnd,
		isDragging,
		index,
	}: {
		track: OrpheusTrack
		onSwitchTrack: (index: number) => void
		onRemoveTrack: (index: number) => void
		onDragStart: (index: number, translationY: number, touchY: number) => void
		onDragUpdate: (translationY: number) => void
		onDragEnd: () => void
		isDragging: boolean
		index: number
	}) => {
		const colors = useTheme().colors
		const isCurrentTrack = useIsCurrentTrack(track.id)
		const dragPan = usePanGesture({
			activateAfterLongPress: 300,
			runOnJS: true,
			onActivate: (event) => onDragStart(index, event.translationY, event.y),
			onUpdate: (event) => onDragUpdate(event.translationY),
			onFinalize: onDragEnd,
		})
		return (
			<GestureDetector gesture={dragPan}>
				<View
					collapsable={false}
					style={{
						backgroundColor: isCurrentTrack
							? colors.elevation.level5
							: undefined,
						overflow: 'hidden',
						height: ROW_HEIGHT,
						opacity: isDragging ? 0.35 : 1,
					}}
				>
					<Touchable
						style={{ flex: 1 }}
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
				</View>
			</GestureDetector>
		)
	},
)

TrackItem.displayName = 'TrackItem'

interface PlayerQueueModalProps extends TrueSheetProps {
	sheetRef?: RefObject<TrueSheet | null>
}

function PlayerQueueModal({ sheetRef, ...props }: PlayerQueueModalProps) {
	const [clearing, setClearing] = useState(false)
	const { deferAction, runPendingAction } = useDeferredSheetAction()

	const dismissWithAction = useCallback(
		(action: () => void) => {
			deferAction(action)
			void usePlayerQueueSheetStore.getState().close()
		},
		[deferAction],
	)

	const clearQueue = () => {
		dismissWithAction(() => {
			alert('清空播放队列', '清空播放队列并停止播放？', [
				{ text: '取消' },
				{
					text: '清空',
					onPress: () => {
						setClearing(true)
						void clearPlaybackQueue()
							.catch((error: unknown) =>
								toastAndLogError('清空播放队列失败', error, 'Player.Queue'),
							)
							.finally(() => setClearing(false))
					},
				},
			])
		})
	}
	const currentTrackId = useCurrentTrackIdHook()
	const theme = useTheme()
	const [didInitialScroll, setDidInitialScroll] = useState(false)
	const flatListRef = useRef<LegendListRef>(null)
	const listHeightRef = useRef(0)
	const contentHeightRef = useRef(0)
	const scrollOffsetRef = useRef(0)
	const dragTranslationRef = useRef(0)
	const dragStartTranslationRef = useRef(0)
	const dragOriginRef = useRef(0)
	const dragTouchOffsetRef = useRef(ROW_HEIGHT / 2)
	const scrollDirectionRef = useRef(0)
	const dragRef = useRef<{ from: number; to: number; slot: number } | null>(
		null,
	)
	const [drag, setDrag] = useState<{
		from: number
		to: number
		slot: number
	} | null>(null)
	const ghostY = useSharedValue(0)
	const lineY = useSharedValue(0)
	const ghostStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: ghostY.value }],
	}))
	const lineStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: lineY.value }],
	}))
	const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const stopAutoScroll = useCallback(() => {
		if (autoScrollRef.current !== null) clearInterval(autoScrollRef.current)
		autoScrollRef.current = null
		scrollDirectionRef.current = 0
	}, [])
	useEffect(() => stopAutoScroll, [stopAutoScroll])
	const scrollableRef = useMemo(
		() => ({
			get current() {
				return flatListRef.current?.getNativeScrollRef() ?? null
			},
		}),
		[],
	)

	const queue = usePlayerQueueStore((state) => state.tracks)
	const queueRef = useRef(queue)
	useEffect(() => {
		queueRef.current = queue
	}, [queue])
	const { data: shuffleMode } = useShuffleMode()

	const currentIndex = useMemo(() => {
		if (!currentTrackId) return -1
		return queue.findIndex((t) => t.id === currentTrackId)
	}, [currentTrackId, queue])

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

	const updateDropTarget = useCallback(
		(translationY: number) => {
			const active = dragRef.current
			if (!active) return
			const ghostTop =
				dragOriginRef.current + translationY - dragStartTranslationRef.current
			ghostY.set(ghostTop)
			const slot = Math.max(
				0,
				Math.min(
					queueRef.current.length,
					Math.round(
						(ghostTop + dragTouchOffsetRef.current + scrollOffsetRef.current) /
							ROW_HEIGHT,
					),
				),
			)
			lineY.set(slot * ROW_HEIGHT - scrollOffsetRef.current - 1)
			const to = slot > active.from ? slot - 1 : slot
			if (slot !== active.slot) {
				dragRef.current = { ...active, to, slot }
				setDrag(dragRef.current)
			}
		},
		[ghostY, lineY],
	)

	const updateDrag = useCallback(
		(translationY: number) => {
			if (!dragRef.current) return
			dragTranslationRef.current = translationY
			updateDropTarget(translationY)
			const localY =
				dragOriginRef.current +
				translationY -
				dragStartTranslationRef.current +
				dragTouchOffsetRef.current
			const direction =
				localY < EDGE_ZONE
					? -1
					: localY > listHeightRef.current - EDGE_ZONE
						? 1
						: 0
			if (direction === scrollDirectionRef.current) return
			stopAutoScroll()
			if (direction !== 0) {
				scrollDirectionRef.current = direction
				autoScrollRef.current = setInterval(() => {
					const maxOffset = Math.max(
						0,
						contentHeightRef.current - listHeightRef.current,
					)
					const next = Math.max(
						0,
						Math.min(
							maxOffset,
							scrollOffsetRef.current + direction * SCROLL_STEP,
						),
					)
					if (next === scrollOffsetRef.current) return
					void flatListRef.current?.scrollToOffset({
						offset: next,
						animated: false,
					})
					scrollOffsetRef.current = next
					updateDropTarget(dragTranslationRef.current)
				}, 16)
			}
		},
		[stopAutoScroll, updateDropTarget],
	)

	const startDrag = useCallback(
		(index: number, translationY: number, touchY: number) => {
			if (dragRef.current || queueRef.current.length < 2) return
			const touchOffset = Math.max(0, Math.min(ROW_HEIGHT, touchY))
			const slot = index + (touchOffset >= ROW_HEIGHT / 2 ? 1 : 0)
			const next = { from: index, to: index, slot }
			dragRef.current = next
			setDrag(next)
			dragStartTranslationRef.current = translationY
			dragTranslationRef.current = translationY
			dragTouchOffsetRef.current = touchOffset
			dragOriginRef.current = index * ROW_HEIGHT - scrollOffsetRef.current
			ghostY.set(dragOriginRef.current)
			lineY.set(slot * ROW_HEIGHT - scrollOffsetRef.current - 1)
			void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
		},
		[ghostY, lineY],
	)

	const endDrag = useCallback(() => {
		stopAutoScroll()
		const active = dragRef.current
		dragRef.current = null
		setDrag(null)
		if (active && active.from !== active.to) {
			void Orpheus.moveTrack(active.from, active.to).catch((error: unknown) =>
				toastAndLogError('调整播放队列失败', error, 'Player.Queue'),
			)
		}
	}, [stopAutoScroll])

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
				onDragStart={startDrag}
				onDragUpdate={updateDrag}
				onDragEnd={endDrag}
				isDragging={drag?.from === index}
			/>
		),
		[
			switchTrackHandler,
			removeTrackHandler,
			startDrag,
			updateDrag,
			endDrag,
			drag,
		],
	)

	const scrollToCurrent = useCallback(() => {
		if (currentIndex === -1 || !queue.length || didInitialScroll) return
		void flatListRef.current?.scrollToIndex({
			animated: false,
			index: currentIndex,
			viewPosition: 0.5,
		})
		setDidInitialScroll(true)
	}, [currentIndex, queue.length, didInitialScroll])

	const saveQueueToPlaylistHandler = useCallback(() => {
		if (queue.length === 0) return
		dismissWithAction(() =>
			useModalStore.getState().open('SaveQueueToPlaylist', {
				trackIds: queue.map((t) => t.id),
			}),
		)
	}, [queue, dismissWithAction])

	const menuActions = useMenuActions([
		{
			title: '反序剩余歌曲',
			image: REVERSE_QUEUE_ICON,
			onPress: () => {
				void reverseRemainingQueueHandler()
			},
			attributes: {
				disabled:
					queue.length === 0 || currentIndex === -1 || shuffleMode !== false,
			},
		},
		{
			title: '保存为播放列表',
			image: SAVE_QUEUE_ICON,
			onPress: saveQueueToPlaylistHandler,
			attributes: { disabled: queue.length === 0 },
		},
		{
			title: '清空播放队列',
			image: CLEAR_QUEUE_ICON,
			onPress: clearQueue,
			attributes: { disabled: clearing || queue.length === 0 },
		},
	])

	return (
		<TrueSheet
			name='playerQueueModal'
			ref={sheetRef}
			detents={[0.75, 1]}
			cornerRadius={24}
			backgroundColor={theme.colors.elevation.level1}
			style={{ flex: 1 }}
			scrollableRef={scrollableRef}
			onMount={scrollToCurrent}
			onDidPresent={() => {
				usePlayerQueueSheetStore.getState().setOpen(true)
			}}
			onDidDismiss={() => {
				stopAutoScroll()
				dragRef.current = null
				setDrag(null)
				usePlayerQueueSheetStore.getState().setOpen(false)
				setDidInitialScroll(false)
				runPendingAction()
			}}
			{...props}
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<View
					style={{
						flex: 1,
					}}
				>
					<View
						style={{
							flexDirection: 'row',
							justifyContent: 'space-between',
							alignItems: 'center',
							paddingHorizontal: 16,
							paddingTop: 16,
							borderBottomWidth: 1,
							borderBottomColor: theme.colors.elevation.level2,
						}}
					>
						<Text variant='titleMedium'>播放队列 ({queue.length})</Text>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<MenuView {...menuActions}>
								<IconButton
									icon='dots-vertical'
									disabled={clearing}
									loading={clearing}
									testID='player-queue-menu'
								/>
							</MenuView>
						</View>
					</View>
					<View
						style={{ flex: 1, minHeight: 2, overflow: 'hidden' }}
						onLayout={(event) => {
							listHeightRef.current = event.nativeEvent.layout.height
						}}
					>
						<LegendList
							ref={flatListRef}
							data={queue}
							renderItem={renderItem}
							keyExtractor={keyExtractor}
							recycleItems
							showsVerticalScrollIndicator={false}
							nestedScrollEnabled
							scrollEnabled={drag === null}
							onScroll={(event) => {
								scrollOffsetRef.current = event.nativeEvent.contentOffset.y
								if (dragRef.current)
									updateDropTarget(dragTranslationRef.current)
							}}
							onContentSizeChange={(_width, height) => {
								contentHeightRef.current = height
							}}
						/>
						{drag && (
							<Animated.View
								pointerEvents='none'
								style={[
									{
										position: 'absolute',
										left: 16,
										right: 16,
										top: 0,
										height: 3,
										borderRadius: 2,
										backgroundColor: theme.colors.primary,
										zIndex: 1,
									},
									lineStyle,
								]}
							/>
						)}
						{drag && queue[drag.from] && (
							<Animated.View
								pointerEvents='none'
								style={[
									{
										position: 'absolute',
										left: 0,
										right: 0,
										top: 0,
										height: ROW_HEIGHT,
										justifyContent: 'center',
										paddingHorizontal: 16,
										backgroundColor: Color(theme.colors.elevation.level5)
											.alpha(0.82)
											.rgb()
											.string(),
										elevation: 8,
										zIndex: 2,
									},
									ghostStyle,
								]}
							>
								<Text
									variant='bodyMedium'
									numberOfLines={1}
								>
									{queue[drag.from].title}
								</Text>
								<Text
									variant='bodySmall'
									numberOfLines={1}
								>
									{queue[drag.from].artist ?? '未知作者'}
								</Text>
							</Animated.View>
						)}
					</View>
				</View>
			</GestureHandlerRootView>
		</TrueSheet>
	)
}

export default PlayerQueueModal
