import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import type { Playlist } from '@/types/core/media'
import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text } from 'react-native-paper'

const LocalPlaylistItem = memo(
	({ item }: { item: Playlist & { isToView?: boolean } }) => {
		const router = useRouter()

		return (
			<View>
				<RectButton
					style={styles.rectButton}
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
						<View style={styles.itemContainer}>
							<CoverWithPlaceHolder
								id={item.id}
								coverUrl={item.coverUrl}
								title={item.title}
								size={48}
							/>
							<View style={styles.textContainer}>
								<Text variant='titleMedium'>{item.title}</Text>
								<View style={styles.subtitleContainer}>
									<Text variant='bodySmall'>
										{item.isToView
											? '与\u2009B\u2009站「稍后再看」同步'
											: `${item.itemCount}\u2009首歌曲`}
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
	subtitleContainer: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 4,
	},
})

LocalPlaylistItem.displayName = 'LocalPlaylistItem'

export default LocalPlaylistItem
