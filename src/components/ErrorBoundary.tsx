import { flatErrorMessage } from '@/utils/log'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from 'react-native-paper'

export default function GlobalErrorFallback({
	error,
	resetError,
}: {
	error: unknown
	resetError: () => void
}) {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>发生未捕获错误</Text>
			<Text style={styles.message}>
				{error instanceof Error ? flatErrorMessage(error) : String(error)}
			</Text>
			<Button
				mode='contained'
				labelStyle={styles.buttonLabel}
				onPress={resetError}
			>
				重试
			</Button>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
	},
	title: {
		marginBottom: 8,
		fontWeight: 'bold',
		fontSize: 20,
	},
	message: {
		marginBottom: 20,
		textAlign: 'center',
	},
	buttonLabel: {
		fontWeight: 'bold',
	},
})
