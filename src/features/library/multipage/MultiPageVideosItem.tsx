import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import { formatDurationToHHMMSS } from '@/utils/time'
import { useRouter } from 'expo-router'
import { memo } from 'react'
import { View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

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
