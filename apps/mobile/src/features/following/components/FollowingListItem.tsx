import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { StyleSheet } from 'react-native'
import { List } from 'react-native-paper'

import type { BilibiliFollowingProfile } from '@/types/apis/bilibili'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'

export function FollowingListItem({
	user,
}: {
	user: BilibiliFollowingProfile
}) {
	const router = useRouter()
	return (
		<List.Item
			title={user.uname}
			titleNumberOfLines={1}
			description={user.sign || '查看投稿'}
			descriptionNumberOfLines={1}
			style={styles.row}
			left={() => (
				<Image
					source={resolveBilibiliImageUrl(user.face)}
					recyclingKey={String(user.mid)}
					style={styles.avatar}
				/>
			)}
			right={(props) => (
				<List.Icon
					{...props}
					icon='chevron-right'
				/>
			)}
			onPress={() =>
				router.navigate({
					pathname: '/playlist/remote/uploader/[mid]',
					params: { mid: user.mid.toString() },
				})
			}
		/>
	)
}

const styles = StyleSheet.create({
	row: { height: 72 },
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		marginLeft: 16,
		alignSelf: 'center',
	},
})
