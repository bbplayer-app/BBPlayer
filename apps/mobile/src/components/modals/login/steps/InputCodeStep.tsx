import { StyleSheet } from 'react-native'
import { Dialog, HelperText, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'

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
	return (
		<>
			<Dialog.Title>输入验证码</Dialog.Title>
			<Dialog.Content>
				<Text
					variant='bodyMedium'
					style={styles.description}
				>
					验证码已发送至 +86 {tel}
				</Text>
				<TextInput
					label='短信验证码'
					value={smsCode}
					onChangeText={(v) => {
						setSmsCode(v)
						setCodeError('')
					}}
					mode='outlined'
					keyboardType='number-pad'
					autoComplete='one-time-code'
					style={styles.input}
					error={!!codeError}
				/>
				{codeError ? (
					<HelperText
						type='error'
						visible={!!codeError}
					>
						{codeError}
					</HelperText>
				) : null}
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={onPrev}>上一步</Button>
				<Button
					mode='contained'
					onPress={onLogin}
					loading={isLoggingIn}
					disabled={isLoggingIn}
				>
					登录
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	input: {
		marginTop: 8,
	},
	description: {
		marginBottom: 8,
	},
})
