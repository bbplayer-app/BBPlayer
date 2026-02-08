import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'

interface DownloadHeaderProps {
	taskCount: number
	onClearAll: () => void
}

/**
 * 下载页面的操作栏，显示任务总数、全部开始和清除按钮。
 */
export default function DownloadHeader({
	taskCount,
	onClearAll,
}: DownloadHeaderProps) {
	const { colors } = useTheme()

	return (
		<View
			style={[styles.container, { borderBottomColor: colors.outlineVariant }]}
		>
			<Text
				variant='bodyMedium'
				style={{ color: colors.onSurfaceVariant }}
			>
				总共 {taskCount} 个任务
			</Text>
			<View style={styles.buttonContainer}>
				<Button
					mode='outlined'
					onPress={onClearAll}
					disabled={taskCount === 0}
				>
					全部清除
				</Button>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: 1,
	},
	buttonContainer: {
		flexDirection: 'row',
		gap: 8,
	},
})
