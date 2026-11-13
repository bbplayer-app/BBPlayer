import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'

import { CommentRepliesList } from '@/features/comments/components/CommentsList'

export default function ReplyCommentsPage() {
	const { bvid, rpid } = useLocalSearchParams<{ bvid: string; rpid: string }>()
	const { colors } = useTheme()
	const router = useRouter()
	const rpidNumber = Number(rpid)

	const valid =
		!!bvid && !!rpid && Number.isFinite(rpidNumber) && rpidNumber > 0

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='评论回复' />
			</Appbar.Header>
			{valid ? (
				<CommentRepliesList
					bvid={bvid}
					rpid={rpidNumber}
				/>
			) : (
				<Text>无效的评论参数</Text>
			)}
		</View>
	)
}

const styles = StyleSheet.create({ container: { flex: 1 } })
