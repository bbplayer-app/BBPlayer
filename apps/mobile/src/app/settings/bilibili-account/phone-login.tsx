import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Appbar, Surface, useTheme } from 'react-native-paper'

import GeetestVerifyStep from '@/components/modals/login/steps/GeetestVerifyStep'
import InputCodeStep from '@/components/modals/login/steps/InputCodeStep'
import InputPhoneStep from '@/components/modals/login/steps/InputPhoneStep'
import SuccessStep from '@/components/modals/login/steps/SuccessStep'
import { usePhoneLogin } from '@/hooks/auth/usePhoneLogin'

export default function PhoneLoginPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const {
		step,
		tel,
		setTel,
		smsCode,
		setSmsCode,
		captchaParams,
		isSendingCode,
		isLoggingIn,
		phoneError,
		setPhoneError,
		codeError,
		setCodeError,
		handleRequestCode,
		handleGeetestMessage,
		handleLogin,
		cancelGeetest,
		prevStep,
	} = usePhoneLogin({ onClose: () => router.back() })

	const content =
		step === 'success' ? (
			<SuccessStep />
		) : step === 'input_code' ? (
			<InputCodeStep
				tel={tel}
				smsCode={smsCode}
				setSmsCode={setSmsCode}
				codeError={codeError}
				setCodeError={setCodeError}
				isLoggingIn={isLoggingIn}
				onPrev={prevStep}
				onLogin={handleLogin}
			/>
		) : step === 'geetest_verify' && captchaParams ? (
			<GeetestVerifyStep
				gt={captchaParams.gt}
				challenge={captchaParams.challenge}
				onMessage={handleGeetestMessage}
				onCancel={cancelGeetest}
			/>
		) : (
			<InputPhoneStep
				tel={tel}
				setTel={setTel}
				phoneError={phoneError}
				setPhoneError={setPhoneError}
				isSendingCode={isSendingCode}
				onBack={() => router.back()}
				onRequestCode={handleRequestCode}
			/>
		)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='手机号登录 Bilibili' />
			</Appbar.Header>
			<View style={styles.content}>
				<Surface
					mode='flat'
					style={[styles.panel, { backgroundColor: colors.surface }]}
				>
					{content}
				</Surface>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 20,
	},
	panel: {
		borderRadius: 8,
		overflow: 'hidden',
		paddingVertical: 8,
	},
})
