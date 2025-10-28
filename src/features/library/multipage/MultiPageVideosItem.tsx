import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import type { RootStackParamList } from '@/types/navigation'
import { formatDurationToHHMMSS } from '@/utils/time'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { memo } from 'react'
import { View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

const MultiPageVideosItem = memo(
	({ item }: { item: BilibiliFavoriteListContent }) => {
		const navigation =
			useNavigation<NativeStackNavigationProp<RootStackParamList>>()

		return (
			<>
				<View>
					<RectButton
						onPress={() => {
							navigation.navigate('PlaylistMultipage', { bvid: item.bvid })
						}}
						style={{ paddingVertical: 8, overflow: 'hidden' }}
					>
						<View
							style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
						>
							<CoverWithPlaceHolder
								id={item.bvid}
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
									{item.upper.name} •{''}
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

MultiPageVideosItem.displayName = 'MultiPageVideosItem'

export default MultiPageVideosItem
