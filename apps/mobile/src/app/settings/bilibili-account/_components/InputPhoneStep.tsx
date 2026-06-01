import { StyleSheet, View } from 'react-native'
import { HelperText, Icon, Text, TextInput, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'

interface Props {
	tel: string
	setTel: (v: string) => void
	phoneError: string
	setPhoneError: (v: string) => void
	isSendingCode: boolean
	onBack: () => void
	onRequestCode: () => void
}

export default function InputPhoneStep({
	tel,
	setTel,
	phoneError,
	setPhoneError,
	isSendingCode,
	onRequestCode,
}: Props) {
	const { colors } = useTheme()

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Icon
					source='television-play'
					size={56}
					color='#FB7299'
				/>
				<Text
					variant='headlineLarge'
					style={styles.title}
				>
					手机号登录
				</Text>
				<Text
					variant='bodyLarge'
					style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
				>
					未注册的手机号验证后将自动创建账号
				</Text>
			</View>

			<View style={styles.form}>
				<TextInput
					label='请输入手机号'
					value={tel}
					onChangeText={(v) => {
						setTel(v)
						setPhoneError('')
					}}
					mode='outlined'
					keyboardType='phone-pad'
					autoComplete='tel'
					error={!!phoneError}
				/>
				{phoneError ? (
					<HelperText
						type='error'
						visible={!!phoneError}
						style={styles.error}
					>
						{phoneError}
					</HelperText>
				) : null}
			</View>

			<View style={styles.actions}>
				<Button
					mode='contained'
					onPress={onRequestCode}
					loading={isSendingCode}
					disabled={isSendingCode || !tel}
					style={styles.button}
					contentStyle={styles.buttonContent}
					labelStyle={styles.buttonLabel}
				>
					获取验证码
				</Button>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 32,
		paddingTop: 32,
		paddingBottom: 24,
	},
	header: {
		marginBottom: 40,
		alignItems: 'center',
		gap: 12,
	},
	title: {
		fontWeight: '900',
	},
	subtitle: {
		textAlign: 'center',
	},
	form: {
		minHeight: 80,
	},
	error: {
		paddingHorizontal: 0,
		marginTop: 4,
	},
	actions: {
		marginTop: 24,
	},
	button: {
		borderRadius: 28,
	},
	buttonContent: {
		height: 52,
	},
	buttonLabel: {
		fontSize: 16,
		fontWeight: 'bold',
	},
})
