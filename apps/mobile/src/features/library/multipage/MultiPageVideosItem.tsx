import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { useLibraryGrid } from '@/features/library/shared/useLibraryGrid'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import { formatDurationToHHMMSS } from '@/utils/time'

const MultiPageVideosItem = memo(
	({ item }: { item: BilibiliFavoriteListContent }) => {
		const { isGrid, coverSize } = useLibraryGrid()
		const router = useRouter()
		const { colors } = useTheme()

		return (
			<>
				<View>
					<Touchable
						testID='multipage-item'
						androidRipple={{}}
						onPress={() => {
							router.navigate({
								pathname: '/playlist/remote/multipage/[bvid]',
								params: { bvid: item.bvid },
							})
						}}
						style={[
							styles.rectButton,
							isGrid && {
								margin: 6,
								padding: 8,
								borderRadius: 16,
								backgroundColor: colors.elevation.level1,
							},
						]}
					>
						<View
							style={[
								styles.itemContainer,
								isGrid && {
									flexDirection: 'column',
									alignItems: 'flex-start',
									gap: 12,
								},
							]}
						>
							<CoverWithPlaceHolder
								id={item.bvid}
								cover={item.cover}
								title={item.title}
								size={isGrid ? coverSize : LIST_ITEM_COVER_SIZE}
							/>
							<View
								style={[
									styles.textContainer,
									isGrid && { marginLeft: 0, width: '100%' },
								]}
							>
								<Text
									variant='titleMedium'
									numberOfLines={isGrid ? 2 : undefined}
									style={styles.title}
								>
									{item.title}
								</Text>
								<Text variant='bodySmall'>
									{item.upper.name}
									{'\u2009'}•{''}
									{item.duration ? formatDurationToHHMMSS(item.duration) : ''}
								</Text>
							</View>
							{!isGrid && (
								<Icon
									source='arrow-right'
									size={24}
								/>
							)}
						</View>
					</Touchable>
				</View>
				{!isGrid && <Divider />}
			</>
		)
	},
)

const styles = StyleSheet.create({
	rectButton: {
		paddingVertical: 8,
		overflow: 'hidden',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 8,
	},
	textContainer: {
		marginLeft: 12,
		flex: 1,
	},
	title: {
		paddingRight: 8,
	},
})

MultiPageVideosItem.displayName = 'MultiPageVideosItem'

export default MultiPageVideosItem
