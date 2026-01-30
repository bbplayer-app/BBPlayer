import { StyleSheet, View } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'

interface PlaylistErrorProps {
	text?: string
	onRetry?: () => void
}

export function PlaylistError({
	text = '加载失败',
	onRetry,
}: PlaylistErrorProps) {
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
