import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { BilibiliCollection } from '@/types/apis/bilibili'

const CollectionListItem = memo(({ item }: { item: BilibiliCollection }) => {
	const router = useRouter()

	return (
		<View>
			<RectButton
				enabled={item.state !== 1}
				onPress={() => {
					if (item.attr === 0) {
						router.push({
							pathname: '/playlist/remote/collection/[id]',
							params: { id: String(item.id) },
						})
					} else {
						router.push({
							pathname: '/playlist/remote/favorite/[id]',
							params: { id: String(item.id) },
						})
					}
				}}
				style={styles.rectButton}
			>
				<View>
					<View style={styles.itemContainer}>
						<CoverWithPlaceHolder
							id={item.id}
							coverUrl={item.cover}
							title={item.title}
							size={48}
						/>
						<View style={styles.textContainer}>
							<Text
								variant='titleMedium'
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
	title: {
		paddingRight: 8,
	},
})

CollectionListItem.displayName = 'CollectionListItem'

export default CollectionListItem
