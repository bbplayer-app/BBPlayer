import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import type { BilibiliPlaylist } from '@/types/apis/bilibili'

const FavoriteFolderListItem = memo(({ item }: { item: BilibiliPlaylist }) => {
	const router = useRouter()

	return (
		<View>
			<RectButton
				onPress={() => {
					router.push({
						pathname: '/playlist/remote/favorite/[id]',
						params: { id: String(item.id) },
					})
				}}
				style={styles.rectButton}
				testID={`favorite-folder-${item.id}`}
			>
				<View>
					<View style={styles.itemContainer}>
						<CoverWithPlaceHolder
							id={item.id}
							coverUrl={undefined}
							title={item.title}
							size={LIST_ITEM_COVER_SIZE}
						/>
						<View style={styles.textContainer}>
							<Text
								variant='titleMedium'
								numberOfLines={1}
							>
								{item.title}
							</Text>
							<Text variant='bodySmall'>{item.media_count}&thinsp;首歌曲</Text>
						</View>
						<Icon
							source='arrow-right'
							size={24}
						/>
					</View>
				</View>
			</RectButton>
			<Divider />
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
})

FavoriteFolderListItem.displayName = 'FavoriteFolderListItem'

export default FavoriteFolderListItem
