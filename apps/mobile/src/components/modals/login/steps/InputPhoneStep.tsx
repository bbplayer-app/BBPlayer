import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { StyleSheet } from 'react-native'
import { Dialog, HelperText } from 'react-native-paper'

import Button from '@/components/common/Button'
import useTextFieldState from '@/hooks/useTextFieldState'

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
	onBack,
	onRequestCode,
}: Props) {
	const telState = useTextFieldState(tel)

	return (
		<>
			<Dialog.Title>手机号登录</Dialog.Title>
			<Dialog.Content>
				<Host
					matchContents={{ vertical: true }}
					style={styles.input}
				>
					<OutlinedTextField
						value={telState}
						onValueChange={(v) => {
							setTel(v)
							setPhoneError('')
						}}
						singleLine
						isError={!!phoneError}
						keyboardOptions={{ keyboardType: 'phone' }}
						modifiers={[fillMaxWidth()]}
					>
						<OutlinedTextField.Label>
							<ComposeText>+86 手机号</ComposeText>
						</OutlinedTextField.Label>
					</OutlinedTextField>
				</Host>
				{phoneError ? (
					<HelperText
						type='error'
						visible={!!phoneError}
					>
						{phoneError}
					</HelperText>
				) : null}
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={onBack}>取消</Button>
				<Button
					mode='contained'
					onPress={onRequestCode}
					loading={isSendingCode}
					disabled={isSendingCode}
				>
					获取验证码
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	input: {
		marginTop: 8,
	},
})
