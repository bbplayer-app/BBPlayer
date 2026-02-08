import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Orpheus } from '@bbplayer/orpheus'
import {
	TrueSheet,
	type TrueSheetProps,
} from '@lodev09/react-native-true-sheet'
import type { FlashListRef } from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from 'react'
import { View } from 'react-native'
import {
	GestureHandlerRootView,
	RectButton,
} from 'react-native-gesture-handler'
import { Surface, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import { useModalStore } from '@/hooks/stores/useModalStore'

const TrackItem = memo(
	({
		track,
		onSwitchTrack,
		onRemoveTrack,
		isCurrentTrack,
		index,
	}: {
		track: OrpheusTrack
		onSwitchTrack: (index: number) => void
		onRemoveTrack: (index: number) => void
		isCurrentTrack: boolean
		index: number
	}) => {
		const colors = useTheme().colors
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
				<RectButton onPress={() => onSwitchTrack(index)}>
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
				</RectButton>
			</Surface>
		)
	},
)

TrackItem.displayName = 'TrackItem'

interface PlayerQueueModalProps extends TrueSheetProps {
	sheetRef: RefObject<TrueSheet | null>
	isVisible: boolean
}

function PlayerQueueModal({
	sheetRef,
	isVisible,
	...props
}: PlayerQueueModalProps) {
	const currentTrackId = useCurrentTrackId()
	const theme = useTheme()
	const [didInitialScroll, setDidInitialScroll] = useState(false)
	const flatListRef = useRef<FlashListRef<OrpheusTrack>>(null)

	const { data: queue, refetch } = useQuery<OrpheusTrack[]>({
		queryKey: ['player', 'queue'],
		queryFn: async () => {
			const q = await Orpheus.getQueue()
			return q
		},
		staleTime: 0,
		enabled: isVisible,
		gcTime: 0,
	})

	const currentIndex = useMemo(() => {
		if (!currentTrackId || !queue) return -1
		return queue.findIndex((t) => t.id === currentTrackId)
	}, [currentTrackId, queue])

	const insets = useSafeAreaInsets()

	const switchTrackHandler = useCallback(
		async (index: number) => {
			if (!queue) return
			if (index === -1) return
			const target = queue[index]
			if (!target) return
			if (target.id === currentTrackId) return
			await Orpheus.skipTo(index)
			void refetch()
		},
		[queue, refetch, currentTrackId],
	)

	const removeTrackHandler = useCallback(
		async (index: number) => {
			await Orpheus.removeTrack(index)
			void refetch()
		},
		[refetch],
	)

	const keyExtractor = useCallback((item: OrpheusTrack) => item.id, [])

	const renderItem = useCallback(
		({ item, index }: { item: OrpheusTrack; index: number }) => (
			<TrackItem
				track={item}
				onSwitchTrack={switchTrackHandler}
				onRemoveTrack={removeTrackHandler}
				isCurrentTrack={item.id === currentTrackId}
				index={index}
			/>
		),
		[switchTrackHandler, removeTrackHandler, currentTrackId],
	)

	// eslint-disable-next-line react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change
	useEffect(() => {
		if (isVisible) {
			void refetch()
		} else {
			setDidInitialScroll(false)
		}
	}, [isVisible, refetch])

	useEffect(() => {
		if (
			isVisible &&
			currentIndex !== -1 &&
			!didInitialScroll &&
			queue?.length
		) {
			const timer = setTimeout(() => {
				void flatListRef.current?.scrollToIndex({
					animated: false,
					index: currentIndex,
					viewPosition: 0.5,
				})
				setDidInitialScroll(true)
			}, 100)
			return () => clearTimeout(timer)
		}
	}, [isVisible, currentIndex, didInitialScroll, queue])

	return (
		<TrueSheet
			ref={sheetRef}
			detents={[0.75]}
			cornerRadius={24}
			backgroundColor={theme.colors.elevation.level1}
			scrollable
			{...props}
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<View
					style={{
						height: '100%',
						paddingBottom: insets.bottom,
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
						<Text variant='titleMedium'>播放队列 ({queue?.length ?? 0})</Text>
						<IconButton
							icon='content-save-outline'
							onPress={() => {
								if (queue && queue.length > 0) {
									useModalStore.getState().open('SaveQueueToPlaylist', {
										trackIds: queue.map((t) => t.id),
									})
								}
							}}
							disabled={!queue || queue.length === 0}
						/>
					</View>
					<View style={{ flex: 1, minHeight: 2 }}>
						<FlashList
							ref={flatListRef}
							data={queue}
							renderItem={renderItem}
							keyExtractor={keyExtractor}
							contentContainerStyle={{
								paddingBottom: insets.bottom + 20,
							}}
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
