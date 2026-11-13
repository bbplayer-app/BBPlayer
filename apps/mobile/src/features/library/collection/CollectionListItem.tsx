import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { useLibraryGrid } from '@/features/library/shared/useLibraryGrid'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import type { BilibiliCollection } from '@/types/apis/bilibili'

const CollectionListItem = memo(({ item }: { item: BilibiliCollection }) => {
	const { isGrid, coverSize } = useLibraryGrid()
	const router = useRouter()
	const { colors } = useTheme()

	return (
		<View>
			<Touchable
				testID='collection-item'
				androidRipple={{}}
				disabled={item.state === 1}
				onPress={() => {
					if (item.attr === 0) {
						router.navigate({
							pathname: '/playlist/remote/collection/[id]',
							params: { id: String(item.id) },
						})
					} else {
						router.navigate({
							pathname: '/playlist/remote/favorite/[id]',
							params: { id: String(item.id) },
						})
					}
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
				<View>
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
							id={item.id}
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
								{item.state === 0 ? item.upper.name : '已失效'}
								{'\u2009'}•{''}
								{item.media_count}
								{'\u2009'}首歌曲
							</Text>
						</View>
						{!isGrid && (
							<Icon
								source='arrow-right'
								size={24}
							/>
						)}
					</View>
				</View>
			</Touchable>
			{!isGrid && <Divider />}
		</View>
	)
})

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

CollectionListItem.displayName = 'CollectionListItem'

export default CollectionListItem
