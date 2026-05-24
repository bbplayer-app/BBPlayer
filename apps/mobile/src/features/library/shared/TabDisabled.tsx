import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'

export default function TabDisable() {
	const { colors } = useTheme()
	const router = useRouter()

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Text
				variant='titleMedium'
				style={styles.text}
			>
				登录 bilibili 账号后才能查看合集
			</Text>
			<Button
				mode='contained'
				onPress={() =>
					router.push('/settings/bilibili-account/qrcode-login' as never)
				}
			>
				登录
			</Button>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
	},
	text: {
		textAlign: 'center',
	},
})
