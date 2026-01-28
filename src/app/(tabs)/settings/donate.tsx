import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useModalStore } from '@/hooks/stores/useModalStore'

export default function DonateSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='捐赠支持' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + 20 },
				]}
			>
				<View style={styles.introContainer}>
					<Text
						variant='bodyMedium'
						style={styles.introText}
					>
						如果觉得好用的话，欢迎给 Roitium 打赏！您的所有打赏都将用于让
						Roitium 吃顿疯狂星期四或是买一部 GalGame！ 😋
					</Text>
				</View>
				<List.Item
					title='微信支付'
					description='点击显示收款码'
					left={(props) => (
						<List.Icon
							{...props}
							icon='wechat'
						/>
					)}
					right={(props) => (
						<List.Icon
							{...props}
							icon='chevron-right'
						/>
					)}
					onPress={() => openModal('DonationQR', { type: 'wechat' })}
				/>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 16,
	},
	introContainer: {
		paddingHorizontal: 16,
		paddingVertical: 20,
		alignItems: 'center',
	},
	introText: {
		textAlign: 'center',
		lineHeight: 24,
		opacity: 0.8,
	},
})
