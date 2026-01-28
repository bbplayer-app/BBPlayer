import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import { formatDurationToHHMMSS } from '@/utils/time'

const MultiPageVideosItem = memo(
	({ item }: { item: BilibiliFavoriteListContent }) => {
		const router = useRouter()

		return (
			<>
				<View>
					<RectButton
						onPress={() => {
							router.push({
								pathname: '/playlist/remote/multipage/[bvid]',
								params: { bvid: item.bvid },
							})
						}}
						style={styles.rectButton}
					>
						<View style={styles.itemContainer}>
							<CoverWithPlaceHolder
								id={item.bvid}
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
									{item.upper.name}
									{'\u2009'}•{''}
									{item.duration ? formatDurationToHHMMSS(item.duration) : ''}
								</Text>
							</View>
							<Icon
								source='arrow-right'
								size={24}
							/>
						</View>
					</RectButton>
				</View>
				<Divider />
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
