import { usePhoneLogin } from '@/hooks/auth/usePhoneLogin'

import GeetestVerifyStep from './steps/GeetestVerifyStep'
import InputCodeStep from './steps/InputCodeStep'
import InputPhoneStep from './steps/InputPhoneStep'
import SuccessStep from './steps/SuccessStep'

export default function PhoneLoginModal() {
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
		close,
		handleRequestCode,
		handleGeetestMessage,
		handleLogin,
		cancelGeetest,
		prevStep,
	} = usePhoneLogin()

	if (step === 'success') return <SuccessStep />

	if (step === 'input_code') {
		return (
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
		)
	}

	if (step === 'geetest_verify') {
		if (!captchaParams) return null
		return (
			<GeetestVerifyStep
				gt={captchaParams.gt}
				challenge={captchaParams.challenge}
				onMessage={handleGeetestMessage}
				onCancel={cancelGeetest}
			/>
		)
	}

	return (
		<InputPhoneStep
			tel={tel}
			setTel={setTel}
			phoneError={phoneError}
			setPhoneError={setPhoneError}
			isSendingCode={isSendingCode}
			onBack={close}
			onRequestCode={handleRequestCode}
		/>
	)
}
