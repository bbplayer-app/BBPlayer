import { StyleSheet } from 'react-native'
import { Dialog, HelperText, TextInput } from 'react-native-paper'

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
	onBack,
	onRequestCode,
}: Props) {
	return (
		<>
			<Dialog.Title>手机号登录</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label='手机号'
					value={tel}
					onChangeText={(v) => {
						setTel(v)
						setPhoneError('')
					}}
					mode='outlined'
					keyboardType='phone-pad'
					autoComplete='tel'
					style={styles.input}
					error={!!phoneError}
					left={<TextInput.Affix text='+86' />}
				/>
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
