import { useCallback } from 'react'
import type { WebViewMessageEvent } from 'react-native-webview'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

interface CaptchaParams {
	token: string
	gt: string
	challenge: string
	tel: string
	cid: string
}

interface UseGeetestProps {
	captchaParams: CaptchaParams | null
	onSuccess: (captchaKey: string) => void
	onFail: (errorMsg: string) => void
	onStartRequest: () => void
}

export function useGeetest({
	captchaParams,
	onSuccess,
	onFail,
	onStartRequest,
}: UseGeetestProps) {
	const handleGeetestMessage = useCallback(
		async (event: WebViewMessageEvent) => {
			if (!captchaParams) return

			let parsed: { validate?: string; seccode?: string; challenge?: string }
			try {
				parsed = JSON.parse(event.nativeEvent.data) as typeof parsed
			} catch {
				return
			}

			const { validate, seccode, challenge } = parsed
			if (!validate || !seccode || !challenge) return

			onStartRequest()
			try {
				const smsResult = await bilibiliApi.sendPhoneLoginSms({
					tel: captchaParams.tel,
					cid: captchaParams.cid,
					token: captchaParams.token,
					challenge,
					validate,
					seccode,
				})
				if (smsResult.isErr()) {
					const errCode = smsResult.error.data.msgCode
					let errorMsg = smsResult.error.message
					if (!errorMsg) {
						errorMsg = '发送验证码失败，请稍后重试'
					}
					let isExpiredCaptcha = false
					if (errCode === 86211) {
						isExpiredCaptcha = true
					}
					if (errCode === -105) {
						isExpiredCaptcha = true
					}
					if (isExpiredCaptcha) {
						errorMsg = '图形验证已过期，请重新获取验证码'
					}
					onFail(errorMsg)
					return
				}

				onSuccess(smsResult.value.captcha_key)
				toast.success('验证码已发送', { id: 'phone-login-sms-sent' })
			} catch (error) {
				toastAndLogError(
					'发送验证码失败',
					error,
					'useGeetest.handleGeetestMessage',
				)
				onFail('发送验证码失败')
			}
		},
		[captchaParams, onFail, onStartRequest, onSuccess],
	)

	return {
		handleGeetestMessage,
	}
}
