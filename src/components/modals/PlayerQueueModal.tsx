import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { BottomSheetFlatListMethods } from '@gorhom/bottom-sheet'
import BottomSheet, {
	BottomSheetBackdrop,
	BottomSheetFlatList,
	useBottomSheetTimingConfigs,
	type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import type { Track as OrpheusTrack } from '@roitium/expo-orpheus'
import { Orpheus } from '@roitium/expo-orpheus'
import { useQuery } from '@tanstack/react-query'
import {
	memo,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from 'react'
import { View } from 'react-native'
import {
	IconButton,
	Surface,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { Easing } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
			<TouchableRipple onPress={() => onSwitchTrack(index)}>
				<Surface
					style={{
						backgroundColor: isCurrentTrack
							? colors.elevation.level5
							: undefined,
						overflow: 'hidden',
						borderRadius: 8,
					}}
					elevation={0}
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
							onPress={(e) => {
								e.stopPropagation()
								onRemoveTrack(index)
							}}
						/>
					</View>
				</Surface>
			</TouchableRipple>
		)
	},
)

TrackItem.displayName = 'TrackItem'

function PlayerQueueModal({
	sheetRef,
}: {
	sheetRef: RefObject<BottomSheet | null>
}) {
	const currentTrack = useCurrentTrack()
	const theme = useTheme()
	const [isVisible, setIsVisible] = useState(false)
	const [didInitialScroll, setDidInitialScroll] = useState(false)
	const flatListRef = useRef<BottomSheetFlatListMethods>(null)
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
		if (!currentTrack || !queue) return -1
		return queue.findIndex((t) => t.id === currentTrack.uniqueKey)
	}, [currentTrack, queue])
	const insets = useSafeAreaInsets()

	usePreventRemove(isVisible, () => {
		sheetRef.current?.close()
	})

	const switchTrackHandler = useCallback(
		async (index: number) => {
			if (!queue) return
			if (index === -1) return
			await Orpheus.skipTo(index)
			void refetch()
		},
		[queue, refetch],
	)

	const removeTrackHandler = useCallback(
		async (index: number) => {
			await Orpheus.removeTrack(index)
			void refetch()
		},
		[refetch],
	)

	const keyExtractor = useCallback((item: OrpheusTrack) => item.id, [])

	const animationConfigs = useBottomSheetTimingConfigs({
		duration: 300,
		easing: Easing.exp,
	})

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) =>
			isVisible ? (
				<BottomSheetBackdrop
					{...props}
					disappearsOnIndex={-1}
					appearsOnIndex={0}
					pressBehavior='close'
				/>
			) : null,
		[isVisible],
	)

	const renderItem = useCallback(
		({ item, index }: { item: OrpheusTrack; index: number }) => (
			<TrackItem
				track={item}
				onSwitchTrack={switchTrackHandler}
				onRemoveTrack={removeTrackHandler}
				isCurrentTrack={item.id === currentTrack?.uniqueKey}
				index={index}
			/>
		),
		[switchTrackHandler, removeTrackHandler, currentTrack?.uniqueKey],
	)

	useLayoutEffect(() => {
		// 当菜单被打开时，曲目改变不应该触发滚动。
		if (currentIndex !== -1 && isVisible && !didInitialScroll) {
			flatListRef.current?.scrollToIndex({
				animated: false,
				index: currentIndex,
				viewPosition: 0.5,
			})
			setDidInitialScroll(true)
		}
	}, [isVisible, currentIndex, didInitialScroll])

	return (
		<BottomSheet
			ref={sheetRef}
			index={-1}
			enableDynamicSizing={false}
			enablePanDownToClose={true}
			snapPoints={['75%']}
			backdropComponent={renderBackdrop}
			animationConfigs={animationConfigs}
			onChange={(index) => {
				const nextVisible = index !== -1
				setIsVisible(nextVisible)
				if (nextVisible) {
					void refetch()
				}
				if (!nextVisible) {
					setDidInitialScroll(false)
				}
			}}
			backgroundStyle={{
				backgroundColor: theme.colors.elevation.level1,
			}}
			handleStyle={{
				borderBottomWidth: 1,
				borderBottomColor: theme.colors.elevation.level5,
			}}
		>
			<View
				style={{
					flexDirection: 'row',
					justifyContent: 'space-between',
					alignItems: 'center',
					paddingHorizontal: 16,
					// paddingVertical: 4,
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
			<BottomSheetFlatList
				data={queue}
				ref={flatListRef}
				keyExtractor={keyExtractor}
				getItemLayout={(_: unknown, index: number) => {
					return {
						length: 68,
						offset: 68 * index,
						index,
					}
				}}
				renderItem={renderItem}
				contentContainerStyle={{
					backgroundColor: theme.colors.elevation.level1,
				}}
				showsVerticalScrollIndicator={false}
				style={{ marginBottom: insets.bottom }}
			/>
		</BottomSheet>
	)
}

export default PlayerQueueModal
