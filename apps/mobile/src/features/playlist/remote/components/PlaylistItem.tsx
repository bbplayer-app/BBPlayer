import { memo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Checkbox, Icon, Surface, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import useIsCurrentTrack from '@/hooks/player/useIsCurrentTrack'
import {
	LIST_ITEM_BORDER_RADIUS,
	LIST_ITEM_COVER_SIZE,
} from '@/theme/dimensions'
import { formatDurationToHHMMSS } from '@/utils/time'

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
	titleHtml?: string
}

interface TrackListItemProps {
	index: number
	onTrackPress: () => void
	onMenuPress: (anchor: { x: number; y: number }) => void
	showCoverImage?: boolean
	data: TrackNecessaryData
	disabled?: boolean
	toggleSelected: (id: number) => void
	isSelected: boolean
	selectMode: boolean
	enterSelectMode: (id: number) => void
}

const HighlightedText = ({
	text,
	...props
}: Omit<React.ComponentProps<typeof Text>, 'children'> & { text: string }) => {
	const { colors } = useTheme()
	const parts = text.split(/(<em[^>]*>.*?<\/em>)/g)
	return (
		<Text {...props}>
			{parts.map((part, index) => {
				const match = /<em[^>]*>(.*?)<\/em>/.exec(part)
				if (match) {
					return (
						<Text
							key={index}
							style={{ fontWeight: 'bold', color: colors.primary }}
						>
							{match[1]}
						</Text>
					)
				}
				return <Text key={index}>{part}</Text>
			})}
		</Text>
	)
}

/**
 * 可复用的播放列表项目组件。
 */
export const TrackListItem = memo(function TrackListItem({
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

	// 在非选择模式下，当前播放歌曲高亮；在选择模式下，歌曲被选中时高亮
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
			testID={`track-item-${data.id}`}
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
							cover={data.cover}
							title={data.title}
							size={LIST_ITEM_COVER_SIZE}
						/>
					) : null}

					{/* Title and Details */}
					<View style={styles.titleContainer}>
						{data.titleHtml ? (
							<HighlightedText
								variant='bodySmall'
								text={data.titleHtml}
							/>
						) : (
							<Text variant='bodySmall'>{data.title}</Text>
						)}
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
	},
	dotSeparator: {
		marginHorizontal: 4,
	},
	menuButton: {
		borderRadius: 99999,
		padding: 10,
	},
})
