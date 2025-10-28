import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { BilibiliCollection } from '@/types/apis/bilibili'
import type { RootStackParamList } from '@/types/navigation'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { memo } from 'react'
import { View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

const CollectionListItem = memo(({ item }: { item: BilibiliCollection }) => {
	const navigation =
		useNavigation<NativeStackNavigationProp<RootStackParamList>>()

	return (
		<View>
			<RectButton
				enabled={item.state !== 1}
				onPress={() => {
					if (item.attr === 0) {
						navigation.navigate('PlaylistCollection', {
							id: String(item.id),
						})
					} else {
						navigation.navigate('PlaylistFavorite', { id: String(item.id) })
					}
				}}
				style={{ paddingVertical: 8, overflow: 'hidden' }}
			>
				<View>
					<View
						style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
					>
						<CoverWithPlaceHolder
							id={item.id}
							coverUrl={item.cover}
							title={item.title}
							size={48}
						/>
						<View style={{ marginLeft: 12, flex: 1 }}>
							<Text
								variant='titleMedium'
								style={{ paddingRight: 8 }}
							>
								{item.title}
							</Text>
							<Text variant='bodySmall'>
								{item.state === 0 ? item.upper.name : '已失效'} •{''}
								{item.media_count} 首歌曲
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

CollectionListItem.displayName = 'CollectionListItem'

export default CollectionListItem
