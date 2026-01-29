import { StyleSheet, View } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'

import { useModalStore } from '@/hooks/stores/useModalStore'

export default function TabDisable() {
	const { colors } = useTheme()
	const openModal = useModalStore((state) => state.open)

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
				onPress={() => openModal('QRCodeLogin', undefined)}
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
