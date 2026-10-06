import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

const rows = [0, 1, 2, 3]

/** 转场和首次加载期间只绘制少量静态占位，不挂载列表或启动动画。 */
export function FollowingListSkeleton() {
	const { colors } = useTheme()
	const fill = { backgroundColor: colors.surfaceVariant }
	return (
		<View
			style={styles.container}
			pointerEvents='none'
			accessible={false}
		>
			{rows.map((row) => (
				<View
					key={row}
					style={styles.row}
				>
					<View style={[styles.avatar, fill]} />
					<View style={styles.text}>
						<View style={[styles.title, fill]} />
						<View style={[styles.description, fill]} />
					</View>
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, paddingTop: 16 },
	row: {
		height: 72,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		gap: 16,
	},
	avatar: { width: 48, height: 48, borderRadius: 24 },
	text: { flex: 1, gap: 8 },
	title: { width: '45%', height: 16, borderRadius: 4 },
	description: { width: '75%', height: 14, borderRadius: 4 },
})
