import { StyleSheet } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

export default function SuccessStep() {
	return (
		<>
			<Dialog.Title>登录成功</Dialog.Title>
			<Dialog.Content>
				<Text
					variant='bodyMedium'
					style={styles.description}
				>
					已成功登录 Bilibili 账号 🎉
				</Text>
			</Dialog.Content>
		</>
	)
}

const styles = StyleSheet.create({
	description: {
		marginBottom: 8,
	},
})
