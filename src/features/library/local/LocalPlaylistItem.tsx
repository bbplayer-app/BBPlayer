import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { Playlist } from '@/types/core/media'
import { useRouter } from 'expo-router'
import { memo } from 'react'
import { View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

const LocalPlaylistItem = memo(
	({ item }: { item: Playlist & { isToView?: boolean } }) => {
		const router = useRouter()

		return (
			<View>
				<RectButton
					style={{ paddingVertical: 8, overflow: 'hidden' }}
					onPress={() => {
						router.push({
							pathname: item.isToView
								? '/playlist/remote/toview'
								: '/playlist/local/[id]',
							params: { id: String(item.id) },
						})
					}}
				>
					<View>
						<View
							style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
						>
							<CoverWithPlaceHolder
								id={item.id}
								coverUrl={item.coverUrl}
								title={item.title}
								size={48}
							/>
							<View style={{ marginLeft: 12, flex: 1 }}>
								<Text variant='titleMedium'>
									{item.isToView ? '📌 稍后再看' : item.title}
								</Text>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'flex-end',
										gap: 4,
										// justifyContent: 'space-between',
									}}
								>
									<Text variant='bodySmall'>
										{item.isToView
											? '与 B 站「稍后再看」同步'
											: `${item.itemCount} 首歌曲`}
									</Text>
									{item.type === 'local' || (
										<Icon
											source={'cloud'}
											color={'#87ceeb'}
											size={13}
										/>
									)}
								</View>
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
	},
)

LocalPlaylistItem.displayName = 'LocalPlaylistItem'

export default LocalPlaylistItem
