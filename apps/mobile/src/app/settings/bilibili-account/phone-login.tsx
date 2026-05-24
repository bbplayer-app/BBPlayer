import { useRouter } from 'expo-router'
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'

import { usePhoneLogin } from '@/hooks/auth/usePhoneLogin'

import GeetestVerifyStep from './_components/GeetestVerifyStep'
import InputCodeStep from './_components/InputCodeStep'
import InputPhoneStep from './_components/InputPhoneStep'
import SuccessStep from './_components/SuccessStep'

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
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={styles.keyboardView}
			>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps='handled'
				>
					<View style={styles.formContainer}>{content}</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	keyboardView: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingVertical: 24,
	},
	formContainer: {
		width: '100%',
	},
})
