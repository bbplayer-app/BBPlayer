import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Orpheus } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
import { MenuView } from '@expo/ui/community/menu'
import type { LegendListRef } from '@legendapp/list/react-native'
import { LegendList } from '@legendapp/list/react-native'
import {
	TrueSheet,
	type TrueSheetProps,
} from '@lodev09/react-native-true-sheet'
import type { RefObject } from 'react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView, Touchable } from 'react-native-gesture-handler'
import { Surface, Text, useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrackIdHook from '@/hooks/player/useCurrentTrackId'
import { useIsCurrentTrack } from '@/hooks/player/useIsCurrentTrack'
import { useShuffleMode } from '@/hooks/queries/orpheus'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import { useDeferredSheetAction } from '@/hooks/ui/useDeferredSheetAction'
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
	const scrollableRef = useMemo(
		() => ({
			get current() {
				return flatListRef.current?.getNativeScrollRef() ?? null
			},
		}),
		[],
	)

	const queue = usePlayerQueueStore((state) => state.tracks)
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
		[switchTrackHandler, removeTrackHandler],
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
							<MenuView
								actions={[
									{
										id: 'reverse',
										title: '反序剩余歌曲',
										image: REVERSE_QUEUE_ICON,
										attributes: {
											disabled:
												queue.length === 0 ||
												currentIndex === -1 ||
												shuffleMode !== false,
										},
									},
									{
										id: 'save',
										title: '保存为播放列表',
										image: SAVE_QUEUE_ICON,
										attributes: { disabled: queue.length === 0 },
									},
									{
										id: 'clear',
										title: '清空播放队列',
										image: CLEAR_QUEUE_ICON,
										attributes: {
											destructive: true,
											disabled: clearing || queue.length === 0,
										},
									},
								]}
								onPressAction={({ nativeEvent }) => {
									if (nativeEvent.event === 'reverse')
										void reverseRemainingQueueHandler()
									if (nativeEvent.event === 'save') saveQueueToPlaylistHandler()
									if (nativeEvent.event === 'clear') clearQueue()
								}}
							>
								<IconButton
									icon='dots-vertical'
									disabled={clearing}
									loading={clearing}
									testID='player-queue-menu'
								/>
							</MenuView>
						</View>
					</View>
					<View style={{ flex: 1, minHeight: 2 }}>
						<LegendList
							ref={flatListRef}
							data={queue}
							renderItem={renderItem}
							keyExtractor={keyExtractor}
							recycleItems
							showsVerticalScrollIndicator={false}
							nestedScrollEnabled
						/>
					</View>
				</View>
			</GestureHandlerRootView>
		</TrueSheet>
	)
}

export default PlayerQueueModal
