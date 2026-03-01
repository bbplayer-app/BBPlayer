import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import type { Playlist } from '@/types/core/media'

const LocalPlaylistItem = memo(
	({ item }: { item: Playlist & { isToView?: boolean } }) => {
		const router = useRouter()
		const { colors } = useTheme()
		const isShared = !!item.shareId
		const isRemote = item.type !== 'local'

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
					testID={`local-playlist-${item.id}`}
				>
					<View>
						<View style={styles.itemContainer}>
							<CoverWithPlaceHolder
								id={item.id}
								cover={item.coverUrl}
								title={item.title}
								size={LIST_ITEM_COVER_SIZE}
							/>
							<View style={styles.textContainer}>
								<Text variant='titleMedium'>{item.title}</Text>
								<View style={styles.subtitleContainer}>
									<Text variant='bodySmall'>
										{item.isToView
											? '与\u2009B\u2009站「稍后再看」同步'
											: `${item.itemCount}\u2009首歌曲`}
									</Text>
									{isShared && (
										<Icon
											source='account-group'
											color={colors.primary}
											size={13}
										/>
									)}
									{!isShared && isRemote && (
										<Icon
											source={'cloud'}
											color={colors.primary}
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
