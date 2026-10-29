import { DownloadState } from '@bbplayer/orpheus'
import { Icon as ExpoIcon } from '@expo/ui'
import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'
import {
	usePanGesture,
	GestureDetector,
	Touchable,
} from 'react-native-gesture-handler'
import { Icon, Surface, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import UniversalCheckbox from '@/components/common/UniversalCheckbox'
import { VariantPlainText } from '@/components/common/VariantPlainText'
import useIsCurrentTrack from '@/hooks/player/useIsCurrentTrack'
import {
	LIST_ITEM_COVER_SIZE,
	LIST_ITEM_BORDER_RADIUS,
} from '@/theme/dimensions'
import type { Playlist, Track } from '@/types/core/media'
import { resolveTrackCover } from '@/utils/imageUrl'
import { formatDurationToHHMMSS } from '@/utils/time'

export interface TrackMenuItem {
	title: string
	leadingIcon: ReturnType<typeof ExpoIcon.select>
	onPress: () => void
	danger?: boolean
	isHighFreq?: boolean
}

interface TrackListItemProps {
	index: number
	onTrackPress: () => void
	onMenuPress?: () => void
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
	isReadOnly?: boolean
	downloadState?: DownloadState
}

export function resolveTrackDisplayLines(
	data: Track,
	playlistType: Playlist['type'],
) {
	const rawMainTitle =
		data.source === 'bilibili'
			? (data.bilibiliMetadata.mainTrackTitle?.trim() ?? '')
			: ''
	const isUnmatched = data.source === 'bilibili' && !data.bilibiliMetadata.bvid
	const isExternalOriginalModeTrack =
		isUnmatched ||
		rawMainTitle.startsWith('音源:') ||
		rawMainTitle.startsWith('[未匹配音源]')

	if (isExternalOriginalModeTrack) {
		const artistName = data.artist?.name?.trim()
		const primaryLine = artistName
			? `${data.title} - ${artistName}`
			: data.title

		if (isUnmatched) {
			return {
				primaryLine,
				secondaryLine: '待匹配音源',
				isSourceError: false,
				upName: null,
				hideDetailsRow: true,
			}
		}

		let secondaryLine: string
		let upName: string

		if (rawMainTitle.startsWith('音源:')) {
			const withoutPrefix = rawMainTitle.replace(/^音源:\s*/, '')
			const upMarker = ' · UP: '
			const upIdx = withoutPrefix.lastIndexOf(upMarker)
			secondaryLine =
				(upIdx !== -1 ? withoutPrefix.slice(0, upIdx) : withoutPrefix).trim() ||
				data.title
			upName =
				(upIdx !== -1
					? withoutPrefix.slice(upIdx + upMarker.length)
					: ''
				).trim() || '未知 UP 主'
		} else {
			secondaryLine = '未匹配音源'
			upName = artistName ?? '未知 UP 主'
		}

		return {
			primaryLine,
			secondaryLine,
			isSourceError: false,
			upName,
			hideDetailsRow: false,
		}
	}

	const hasSeparateSourceTitle =
		data.source === 'bilibili' &&
		Boolean(rawMainTitle && rawMainTitle !== data.title) &&
		playlistType !== 'multi_page'

	return {
		primaryLine: data.title,
		secondaryLine: hasSeparateSourceTitle ? rawMainTitle : null,
		isSourceError: false,
		upName: data.artist?.name ?? null,
		hideDetailsRow: false,
	}
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
	isReadOnly,
	downloadState,
}: TrackListItemProps) {
	const theme = useTheme()
	const dark = useColorScheme() === 'dark'
	const isCurrentTrack = useIsCurrentTrack(data.uniqueKey)

	const highlighted = (isCurrentTrack && !selectMode) || isSelected

	const displayLines = useMemo(
		() => resolveTrackDisplayLines(data, playlist.type),
		[data, playlist.type],
	)

	const dragPan = usePanGesture({
		activateAfterLongPress: 200,
		runOnJS: true,
		onActivate: (e) => onDragStart?.(e.absoluteY),
		onUpdate: (e) => onDragUpdate?.(e.absoluteY),
		onFinalize: () => onDragEnd?.(),
	})

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
		<Touchable
			androidRipple={{}}
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
			disabled={disabled}
			testID={`track-item-${index}`}
			onPress={() => {
				if (selectMode) {
					if (!isReadOnly) toggleSelected(data.id)
					return
				}
				if (isCurrentTrack) return
				onTrackPress()
			}}
			onLongPress={() => {
				if (selectMode || isReadOnly) return
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
						{selectMode && (
							<View style={styles.checkboxContainer}>
								<UniversalCheckbox
									status={isSelected ? 'checked' : 'unchecked'}
								/>
							</View>
						)}

						{/* 序号也是 */}
						<View style={{ opacity: selectMode ? 0 : 1 }}>
							<VariantPlainText
								variant='bodyMedium'
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{String(index + 1)}
							</VariantPlainText>
						</View>
					</View>

					{/* Cover Image */}
					{showCoverImage ? (
						<CoverWithPlaceHolder
							id={`${data.id}:${data.coverUrl ?? ''}`}
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
						{/* 第一行：歌曲名称 - 歌曲作者 */}
						<VariantPlainText
							variant='bodySmall'
							numberOfLines={1}
						>
							{displayLines.primaryLine}
						</VariantPlainText>

						{/* 第二行：音源名称（单行省略，不使用跑马灯；selectMode 下隐藏以固定高度） */}
						{!selectMode && displayLines.secondaryLine ? (
							<VariantPlainText
								variant='bodySmall'
								numberOfLines={1}
								style={[
									styles.sourceLineText,
									{
										color: displayLines.isSourceError
											? theme.colors.error
											: theme.colors.onSurfaceVariant,
									},
								]}
							>
								{displayLines.secondaryLine}
							</VariantPlainText>
						) : null}

						{/* 第三行：UP主 · 时长（未匹配音源时隐藏第三行，保持简洁两行） */}
						{!displayLines.hideDetailsRow || selectMode ? (
							<View style={styles.detailsContainer}>
								{displayLines.upName ? (
									<>
										<VariantPlainText
											variant='bodySmall'
											numberOfLines={1}
											style={[
												styles.upNameText,
												{ color: theme.colors.onSurfaceVariant },
											]}
										>
											{displayLines.upName}
										</VariantPlainText>
										{data.duration > 0 ? (
											<VariantPlainText
												style={[
													styles.dotSeparator,
													{ color: theme.colors.onSurfaceVariant },
												]}
												variant='bodySmall'
											>
												·
											</VariantPlainText>
										) : null}
									</>
								) : null}
								{/* Display Duration */}
								<VariantPlainText
									variant='bodySmall'
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{data.duration ? formatDurationToHHMMSS(data.duration) : ''}
								</VariantPlainText>
								{/* 显示下载状态 */}
								{renderDownloadStatus()}
							</View>
						) : null}
					</View>

					{/* Context Menu / Drag Handle */}
					{!disabled && (
						<View>
							{selectMode ? (
								playlist.type === 'local' && !isSearching ? (
									<GestureDetector gesture={dragPan}>
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
								<Touchable
									androidRipple={{}}
									style={styles.menuButton}
									disabled={!onMenuPress}
									onPress={() => onMenuPress?.()}
								>
									<Icon
										source='dots-vertical'
										size={20}
										color={theme.colors.primary}
									/>
								</Touchable>
							)}
						</View>
					)}
				</View>
			</Surface>
		</Touchable>
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
	sourceLineText: {
		marginTop: 2,
	},
	detailsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
		flexWrap: 'nowrap',
	},
	upNameText: {
		flexShrink: 1,
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
