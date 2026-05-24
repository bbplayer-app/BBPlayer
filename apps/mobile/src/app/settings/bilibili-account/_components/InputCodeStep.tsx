import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { StyleSheet, View } from 'react-native'
import { HelperText, Text, useTheme, Icon } from 'react-native-paper'

import Button from '@/components/common/Button'
import useTextFieldState from '@/hooks/useTextFieldState'

interface Props {
	tel: string
	smsCode: string
	setSmsCode: (v: string) => void
	codeError: string
	setCodeError: (v: string) => void
	isLoggingIn: boolean
	onPrev: () => void
	onLogin: () => void
}

export default function InputCodeStep({
	tel,
	smsCode,
	setSmsCode,
	codeError,
	setCodeError,
	isLoggingIn,
	onPrev,
	onLogin,
}: Props) {
	const smsCodeState = useTextFieldState(smsCode)
	const { colors } = useTheme()

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Icon
					source='message-processing-outline'
					size={56}
					color={colors.primary}
				/>
				<Text
					variant='headlineLarge'
					style={styles.title}
				>
					输入验证码
				</Text>
				<Text
					variant='bodyLarge'
					style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
				>
					验证码已发送至 +86 {tel}
					<Text
						onPress={onPrev}
						style={{ color: colors.primary }}
					>
						{' '}
						(修改)
					</Text>
				</Text>
			</View>

			<View style={styles.form}>
				<Host matchContents={{ vertical: true }}>
					<OutlinedTextField
						value={smsCodeState}
						onValueChange={(v) => {
							setSmsCode(v)
							setCodeError('')
						}}
						singleLine
						isError={!!codeError}
						keyboardOptions={{ keyboardType: 'number' }}
						modifiers={[fillMaxWidth()]}
					>
						<OutlinedTextField.Label>
							<ComposeText>短信验证码</ComposeText>
						</OutlinedTextField.Label>
					</OutlinedTextField>
				</Host>
				{codeError ? (
					<HelperText
						type='error'
						visible={!!codeError}
						style={styles.error}
					>
						{codeError}
					</HelperText>
				) : null}
			</View>

			<View style={styles.actions}>
				<Button
					mode='contained'
					onPress={onLogin}
					loading={isLoggingIn}
					disabled={isLoggingIn || !smsCode}
					style={styles.button}
					contentStyle={styles.buttonContent}
					labelStyle={styles.buttonLabel}
				>
					登录
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
