import FunctionalMenu from '@/components/common/FunctionalMenu'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import type { Playlist, Track } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
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
import type { TrackMenuItem } from './LocalPlaylistItem'
import { TrackListItem } from './LocalPlaylistItem'

interface LocalTrackListProps {
	tracks: Track[]
	playlist: Playlist
	handleTrackPress: (track: Track) => void
	trackMenuItems: (track: Track) => TrackMenuItem[]
	selectMode: boolean
	selected: Set<number>
	toggle: (id: number) => void
	enterSelectMode: (id: number) => void
	ListHeaderComponent: Parameters<typeof FlashList>[0]['ListHeaderComponent']
	onEndReached?: () => void
	hasNextPage?: boolean
	isFetchingNextPage?: boolean
}

const renderItem = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<
	Track,
	{
		handleTrackPress: (track: Track) => void
		handleMenuPress: (track: Track, anchor: { x: number; y: number }) => void
		toggle: (id: number) => void
		enterSelectMode: (id: number) => void
		selected: Set<number>
		selectMode: boolean
		playlist: Playlist
	}
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const {
		handleTrackPress,
		handleMenuPress,
		toggle,
		enterSelectMode,
		selected,
		selectMode,
		playlist,
	} = extraData
	return (
		<TrackListItem
			index={index}
			onTrackPress={() => handleTrackPress(item)}
			onMenuPress={(anchor) => {
				handleMenuPress(item, anchor)
			}}
			disabled={
				item.source === 'bilibili' && !item.bilibiliMetadata.videoIsValid
			}
			data={item}
			playlist={playlist}
			toggleSelected={toggle}
			isSelected={selected.has(item.id)}
			selectMode={selectMode}
			enterSelectMode={enterSelectMode}
		/>
	)
}

export function LocalTrackList({
	tracks,
	playlist,
	handleTrackPress,
	trackMenuItems,
	selectMode,
	selected,
	toggle,
	enterSelectMode,
	ListHeaderComponent,
	onEndReached,
	isFetchingNextPage,
	hasNextPage,
}: LocalTrackListProps) {
	const haveTrack = useCurrentTrack()
	const insets = useSafeAreaInsets()
	const theme = useTheme()

	const [menuState, setMenuState] = useState<{
		visible: boolean
		anchor: { x: number; y: number }
		track: Track | null
	}>({
		visible: false,
		anchor: { x: 0, y: 0 },
		track: null,
	})

	const handleMenuPress = useCallback(
		(track: Track, anchor: { x: number; y: number }) => {
			setMenuState({ visible: true, anchor, track })
		},
		[],
	)

	const handleDismissMenu = useCallback(() => {
		setMenuState((prev) => ({ ...prev, visible: false }))
	}, [])

	const keyExtractor = useCallback((item: Track) => String(item.id), [])

	const extraData = useMemo(
		() => ({
			selectMode,
			selected,
			handleTrackPress,
			handleMenuPress,
			toggle,
			enterSelectMode,
			playlist,
		}),
		[
			selectMode,
			selected,
			handleTrackPress,
			handleMenuPress,
			toggle,
			enterSelectMode,
			playlist,
		],
	)

	return (
		<>
			<FlashList
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
					isFetchingNextPage ? (
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
					) : null
				}
				onEndReached={onEndReached}
				onEndReachedThreshold={0.8}
			/>
			{menuState.track && (
				<FunctionalMenu
					visible={menuState.visible}
					onDismiss={handleDismissMenu}
					anchor={menuState.anchor}
					anchorPosition='bottom'
				>
					{trackMenuItems(menuState.track).map((menuItem) => (
						<Menu.Item
							key={menuItem.title}
							titleStyle={menuItem.danger ? { color: theme.colors.error } : {}}
							leadingIcon={menuItem.leadingIcon}
							onPress={() => {
								menuItem.onPress()
								handleDismissMenu()
							}}
							title={menuItem.title}
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
})
