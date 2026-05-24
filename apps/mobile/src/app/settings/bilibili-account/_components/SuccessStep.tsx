import { StyleSheet, View } from 'react-native'
import { Text, useTheme, Icon } from 'react-native-paper'

export default function SuccessStep() {
	const { colors } = useTheme()

	return (
		<View style={styles.container}>
			<View style={styles.iconContainer}>
				<Icon
					source='check-circle'
					size={64}
					color={colors.primary}
				/>
			</View>
			<Text
				variant='headlineMedium'
				style={styles.title}
			>
				登录成功
			</Text>
			<Text
				variant='bodyMedium'
				style={[styles.description, { color: colors.onSurfaceVariant }]}
			>
				已成功登录 Bilibili 账号 🎉
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 32,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
	},
	iconContainer: {
		marginBottom: 8,
	},
	title: {
		fontWeight: 'bold',
	},
	description: {
		textAlign: 'center',
		lineHeight: 20,
	},
})
