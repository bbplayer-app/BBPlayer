import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { useLibraryGrid } from '@/features/library/shared/useLibraryGrid'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import type { Playlist } from '@/types/core/media'

const LocalPlaylistItem = memo(
	({ item }: { item: Playlist & { isToView?: boolean } }) => {
		const { isGrid, coverSize } = useLibraryGrid()
		const router = useRouter()
		const { colors } = useTheme()
		const isShared = !!item.shareId
		const isRemote = item.type !== 'local' && item.type !== 'dynamic'

		return (
			<View>
				<Touchable
					androidRipple={{}}
					style={[
						styles.rectButton,
						isGrid && {
							margin: 6,
							padding: 8,
							borderRadius: 16,
							backgroundColor: colors.elevation.level1,
						},
					]}
					onPress={() => {
						router.navigate({
							pathname: item.isToView
								? '/playlist/remote/toview'
								: '/playlist/local/[id]',
							params: { id: String(item.id) },
						})
					}}
					testID={`local-playlist-${item.id}`}
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
								cover={item.coverUrl}
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
								>
									{item.title}
								</Text>
								<View style={styles.subtitleContainer}>
									<Text
										variant='bodySmall'
										style={{ flexShrink: 1 }}
										numberOfLines={2}
									>
										{item.isToView
											? '与\u2009B\u2009站「稍后再看」同步'
											: `${item.itemCount}\u2009首歌曲`}
									</Text>
									{item.isPinned && (
										<Icon
											source='pin'
											color={colors.primary}
											size={13}
										/>
									)}
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
									{item.type === 'dynamic' && (
										<Icon
											source='merge'
											color={colors.primary}
											size={13}
										/>
									)}
								</View>
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
		flexWrap: 'wrap',
	},
})

LocalPlaylistItem.displayName = 'LocalPlaylistItem'

export default LocalPlaylistItem
