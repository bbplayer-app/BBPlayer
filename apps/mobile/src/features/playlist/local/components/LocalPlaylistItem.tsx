import { DownloadState } from '@bbplayer/orpheus'
import { memo, useCallback } from 'react'
import { Easing, StyleSheet, useColorScheme, View } from 'react-native'
import {
	Gesture,
	GestureDetector,
	RectButton,
} from 'react-native-gesture-handler'
import { Checkbox, Icon, Surface, Text, useTheme } from 'react-native-paper'
import TextTicker from 'react-native-text-ticker'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import useIsCurrentTrack from '@/hooks/player/useIsCurrentTrack'
import { resolveTrackCover } from '@/hooks/player/useLocalCover'
import {
	LIST_ITEM_COVER_SIZE,
	LIST_ITEM_BORDER_RADIUS,
} from '@/theme/dimensions'
import type { Playlist, Track } from '@/types/core/media'
import { formatDurationToHHMMSS } from '@/utils/time'

export interface TrackMenuItem {
	title: string
	leadingIcon: string
	onPress: () => void
	danger?: boolean
	isHighFreq?: boolean
}

interface TrackListItemProps {
	index: number
	onTrackPress: () => void
	onMenuPress: () => void
	/**
	 * 拖拽把手上的 RNGH 合成手势回调。
	 *
	 * `onDragStart(absoluteY)` — 长按阈値到达时触发
	 * `onDragUpdate(absoluteY)` — 手指移动时持续触发
	 * `onDragEnd()` — 手指抬起或手势取消时触发
	 */
	onDragStart?: (absoluteY: number) => void
	onDragUpdate?: (absoluteY: number) => void
	onDragEnd?: () => void
	showCoverImage?: boolean
	data: Track
	disabled?: boolean
	playlist: Playlist
	toggleSelected: (id: number) => void
	isSelected: boolean
	selectMode: boolean
	isSearching?: boolean
	enterSelectMode: (id: number) => void
	downloadState?: DownloadState
}

/**
 * 可复用的播放列表项目组件。
 */
export const TrackListItem = memo(function TrackListItem({
	index,
	onTrackPress,
	onMenuPress,
	onDragStart,
	onDragUpdate,
	onDragEnd,
	showCoverImage = true,
	data,
	disabled = false,
	playlist,
	toggleSelected,
	isSelected,
	selectMode,
	isSearching = false,
	enterSelectMode,
	downloadState,
}: TrackListItemProps) {
	const theme = useTheme()
	const dark = useColorScheme() === 'dark'
	const isCurrentTrack = useIsCurrentTrack(data.uniqueKey)

	const highlighted = (isCurrentTrack && !selectMode) || isSelected

	const renderDownloadStatus = useCallback(() => {
		if (!downloadState) return null
		let iconConfig
		switch (downloadState) {
			case DownloadState.COMPLETED:
				iconConfig = {
					source: 'check-circle-outline',
					color: theme.colors.primary,
				}
				break
			case DownloadState.FAILED:
				iconConfig = {
					source: 'alert-circle-outline',
					color: theme.colors.error,
				}
				break
			default:
				iconConfig = {
					source: 'help-circle-outline',
					color: theme.colors.onSurfaceVariant,
				}
		}

		return (
			<View style={styles.downloadStatusContainer}>
				<Icon
					source={iconConfig.source}
					size={12}
					color={iconConfig.color}
				/>
			</View>
		)
	}, [
		downloadState,
		theme.colors.error,
		theme.colors.onSurfaceVariant,
		theme.colors.primary,
	])

	return (
		<RectButton
			style={[
				styles.rectButton,
				{
					backgroundColor: highlighted
						? dark
							? 'rgba(255, 255, 255, 0.12)'
							: 'rgba(0, 0, 0, 0.12)'
						: 'transparent',
				},
			]}
			delayLongPress={500}
			enabled={!disabled}
			testID={`track-item-${index}`}
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
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{index + 1}
							</Text>
						</View>
					</View>

					{/* Cover Image */}
					{showCoverImage ? (
						<CoverWithPlaceHolder
							id={data.id}
							cover={
								downloadState === DownloadState.COMPLETED
									? resolveTrackCover(data.uniqueKey, data.coverUrl)
									: data.coverUrl
							}
							title={data.title}
							size={LIST_ITEM_COVER_SIZE}
						/>
					) : null}

					{/* Title and Details */}
					<View style={styles.titleContainer}>
						<Text
							variant='bodySmall'
							numberOfLines={selectMode ? 1 : 0}
						>
							{data.title}
						</Text>
						<View style={styles.detailsContainer}>
							{/* Display Artist if available */}
							{data.artist && (
								<>
									<Text
										variant='bodySmall'
										numberOfLines={1}
									>
										{data.artist.name ?? '未知'}
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
							{/* 显示下载状态 */}
							{renderDownloadStatus()}
						</View>
						{/* 显示主视频标题（如果是分 p） — selectMode 下隐藏以固定高度 */}
						{!selectMode &&
							data.source === 'bilibili' &&
							data.bilibiliMetadata.mainTrackTitle &&
							data.bilibiliMetadata.mainTrackTitle !== data.title &&
							playlist.type !== 'multi_page' && (
								<TextTicker
									style={{ ...theme.fonts.bodySmall }}
									loop
									animationType='scroll'
									duration={130 * data.bilibiliMetadata.mainTrackTitle.length}
									easing={Easing.linear}
								>
									{data.bilibiliMetadata.mainTrackTitle}
								</TextTicker>
							)}
					</View>

					{/* Context Menu / Drag Handle */}
					{!disabled && (
						<View>
							{selectMode ? (
								playlist.type === 'local' && !isSearching ? (
									<GestureDetector
										gesture={Gesture.Pan()
											.activateAfterLongPress(200)
											.runOnJS(true)
											.onStart((e) => onDragStart?.(e.absoluteY))
											.onUpdate((e) => onDragUpdate?.(e.absoluteY))
											.onFinalize(() => onDragEnd?.())}
									>
										<View style={styles.menuButton}>
											<Icon
												source='drag-vertical'
												size={20}
												color={theme.colors.onSurfaceVariant}
											/>
										</View>
									</GestureDetector>
								) : null
							) : (
								<RectButton
									style={styles.menuButton}
									onPress={() => onMenuPress()}
								>
									<Icon
										source='dots-vertical'
										size={20}
										color={theme.colors.primary}
									/>
								</RectButton>
							)}
						</View>
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
		borderRadius: LIST_ITEM_BORDER_RADIUS,
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
		flexWrap: 'wrap',
	},
	dotSeparator: {
		marginHorizontal: 4,
	},
	menuButton: {
		borderRadius: 99999,
		padding: 10,
	},
	downloadStatusContainer: {
		paddingLeft: 4,
	},
})
