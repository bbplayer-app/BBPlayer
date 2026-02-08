import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'

interface DataFetchingErrorProps {
	text?: string
	onRetry?: () => void
}

export function DataFetchingError({
	text = '加载失败',
	onRetry,
}: DataFetchingErrorProps) {
	const { colors } = useTheme()
	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Text
				variant='titleMedium'
				style={styles.text}
			>
				{text}
			</Text>
			{onRetry && (
				<Button
					onPress={onRetry}
					mode='contained'
				>
					重试
				</Button>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	text: {
		textAlign: 'center',
		marginBottom: 16,
	},
})
