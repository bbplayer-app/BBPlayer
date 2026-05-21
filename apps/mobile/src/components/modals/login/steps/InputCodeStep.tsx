import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { StyleSheet } from 'react-native'
import { Dialog, HelperText, Text } from 'react-native-paper'

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
				<Host
					matchContents={{ vertical: true }}
					style={styles.input}
				>
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
