import { memo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Checkbox, Icon, Surface, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { ExtraData } from '@/features/playlist/remote/components/RemoteTrackList'
import useIsCurrentTrack from '@/hooks/player/useIsCurrentTrack'
import type { BilibiliTrack } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

import ProgressRing from './ProgressRing'

export interface TrackMenuItem {
	title: string
	leadingIcon: string
	onPress: () => void
}

export const TrackMenuItemDividerToken: TrackMenuItem = {
	title: 'divider',
	leadingIcon: '',
	onPress: () => void 0,
}

export interface TrackNecessaryData {
	cover?: string
	artistCover?: string
	title: string
	duration: number
	id: number
	artistName?: string
	uniqueKey: string
}

interface TrackListItemProps {
	index: number
	onTrackPress: () => void
	onMenuPress: (anchor: { x: number; y: number }) => void
	showCoverImage?: boolean
	data: TrackNecessaryData & { progress: number }
	disabled?: boolean
	toggleSelected: (id: number) => void
	isSelected: boolean
	selectMode: boolean
	enterSelectMode: (id: number) => void
}

/**
 * 可复用的播放列表项目组件。
 */
export const ToViewTrackListItem = memo(function ToViewTrackListItem({
	index,
	onTrackPress,
	onMenuPress,
	showCoverImage = true,
	data,
	disabled = false,
	toggleSelected,
	isSelected,
	selectMode,
	enterSelectMode,
}: TrackListItemProps) {
	const { colors } = useTheme()
	const menuRef = useRef<View>(null)
	const isCurrentTrack = useIsCurrentTrack(data.uniqueKey)

	const highlighted = (isCurrentTrack && !selectMode) || isSelected

	return (
		<RectButton
			style={[
				styles.rectButton,
				{
					backgroundColor: highlighted
						? colors.elevation.level5
						: 'transparent',
				},
			]}
			delayLongPress={500}
			enabled={!disabled}
			onPress={() => {
				if (selectMode) {
					toggleSelected(data.id)
					return
				}
				if (isCurrentTrack) return
				onTrackPress()
			}}
			onLongPress={() => {
				if (selectMode) return
				enterSelectMode(data.id)
			}}
		>
			<Surface
				style={styles.surface}
				elevation={0}
			>
				<View style={styles.itemContainer}>
					{/* Index Number & Checkbox Container */}
					<View style={styles.indexContainer}>
						{/* 始终渲染，或许能降低一点性能开销？ */}
						<View
							style={[
								styles.checkboxContainer,
								{ opacity: selectMode ? 1 : 0 },
							]}
						>
							<Checkbox status={isSelected ? 'checked' : 'unchecked'} />
						</View>

						{/* 序号也是 */}
						<View style={{ opacity: selectMode ? 0 : 1 }}>
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								{index + 1}
							</Text>
						</View>
					</View>

					{/* Cover Image */}
					{showCoverImage ? (
						<CoverWithPlaceHolder
							id={data.id}
							coverUrl={data.cover}
							title={data.title}
							size={48}
						/>
					) : null}

					{/* Title and Details */}
					<View style={styles.titleContainer}>
						<Text variant='bodySmall'>{data.title}</Text>
						<View style={styles.detailsContainer}>
							{/* Display Artist if available */}
							{data.artistName && (
								<>
									<Text
										variant='bodySmall'
										numberOfLines={1}
									>
										{data.artistName ?? '未知'}
									</Text>
									<Text
										style={styles.dotSeparator}
										variant='bodySmall'
									>
										•
									</Text>
								</>
							)}
							{/* Display Duration */}
							<Text variant='bodySmall'>
								{data.duration ? formatDurationToHHMMSS(data.duration) : ''}
							</Text>
						</View>
					</View>

					<ProgressRing
						progressInSeconds={data.progress}
						durationInSeconds={data.duration}
					/>

					{/* Context Menu */}
					{!disabled && (
						<RectButton
							// @ts-expect-error -- 不理解
							ref={menuRef}
							style={styles.menuButton}
							onPress={() =>
								menuRef.current?.measure(
									(_x, _y, _width, _height, pageX, pageY) => {
										onMenuPress({ x: pageX, y: pageY })
									},
								)
							}
							enabled={!selectMode}
						>
							<Icon
								source='dots-vertical'
								size={20}
								color={selectMode ? colors.onSurfaceDisabled : colors.primary}
							/>
						</RectButton>
					)}
				</View>
			</Surface>
		</RectButton>
	)
})

const styles = StyleSheet.create({
	rectButton: {
		paddingVertical: 4,
	},
	surface: {
		overflow: 'hidden',
		borderRadius: 8,
		backgroundColor: 'transparent',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	indexContainer: {
		width: 35,
		marginRight: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	checkboxContainer: {
		position: 'absolute',
	},
	titleContainer: {
		marginLeft: 12,
		flex: 1,
		marginRight: 4,
	},
	detailsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
	},
	dotSeparator: {
		marginHorizontal: 4,
	},
	menuButton: {
		borderRadius: 99999,
		padding: 10,
	},
})

const renderToViewItem = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<
	BilibiliTrack & { progress: number },
	ExtraData
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const { playTrack, handleMenuPress, selection, showItemCover } = extraData

	return (
		<ToViewTrackListItem
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
				progress: item.progress,
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

export default renderToViewItem
