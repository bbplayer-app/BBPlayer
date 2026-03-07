import * as Sentry from '@sentry/react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Dialog, HelperText, Text, TextInput } from 'react-native-paper'
import * as setCookieParser from 'set-cookie-parser'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent } from 'react-native-webview'

import Button from '@/components/common/Button'
import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { userQueryKeys } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

type Step = 'input_phone' | 'geetest_verify' | 'input_code' | 'success'

interface CaptchaParams {
	token: string
	gt: string
	challenge: string
	tel: string
	cid: string
}

const COUNTRY_CODES = [
	{ label: '中国大陆 (+86)', value: '86' },
	{ label: '中国香港 (+852)', value: '852' },
	{ label: '中国台湾 (+886)', value: '886' },
	{ label: '美国/加拿大 (+1)', value: '1' },
	{ label: '日本 (+81)', value: '81' },
	{ label: '韩国 (+82)', value: '82' },
	{ label: '英国 (+44)', value: '44' },
]

function buildGeetestHtml(gt: string, challenge: string): string {
	const gtJson = JSON.stringify(gt)
	const challengeJson = JSON.stringify(challenge)
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .card {
      background: #fff; border-radius: 8px; padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12); width: 90%; max-width: 340px;
    }
    h3 { text-align: center; margin-bottom: 16px; font-size: 16px; color: #333; }
    .err { color: #d32f2f; text-align: center; margin-top: 10px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h3>请完成安全验证</h3>
    <div id="captcha"></div>
    <div class="err" id="err-msg"></div>
  </div>
  <script src="https://static.geetest.com/static/js/gt.0.4.9.js"></script>
  <script>
    initGeetest({
      gt: ${gtJson},
      challenge: ${challengeJson},
      offline: false,
      new_captcha: true,
      product: 'bind',
      width: '100%'
    }, function(captchaObj) {
      captchaObj.appendTo('#captcha');
      captchaObj.onSuccess(function() {
        var r = captchaObj.getValidate();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          validate: r.geetest_validate,
          seccode: r.geetest_seccode,
          challenge: r.geetest_challenge
        }));
      });
      captchaObj.onError(function() {
        document.getElementById('err-msg').textContent = '验证出错，请关闭后重试';
      });
    });
  </script>
</body>
</html>`
}

export default function PhoneLoginModal() {
	const queryClient = useQueryClient()
	const setCookie = useAppStore((state) => state.updateBilibiliCookie)
	const _close = useModalStore((state) => state.close)
	const close = useCallback(() => _close('PhoneLogin'), [_close])

	const [step, setStep] = useState<Step>('input_phone')
	const [cid, setCid] = useState('86')
	const [tel, setTel] = useState('')
	const [smsCode, setSmsCode] = useState('')
	const [captchaKey, setCaptchaKey] = useState('')
	const [captchaParams, setCaptchaParams] = useState<CaptchaParams | null>(null)
	const [isSendingCode, setIsSendingCode] = useState(false)
	const [isLoggingIn, setIsLoggingIn] = useState(false)
	const [phoneError, setPhoneError] = useState('')
	const [codeError, setCodeError] = useState('')

	const selectedCountryLabel =
		COUNTRY_CODES.find((c) => c.value === cid)?.label ?? `+${cid}`

	const handleRequestCode = async () => {
		setPhoneError('')
		const trimmedTel = tel.trim()
		if (!trimmedTel) {
			setPhoneError('请输入手机号')
			return
		}
		// 5~15 位数字，覆盖绝大多数国际手机号
		if (!/^\d{5,15}$/.test(trimmedTel)) {
			setPhoneError('手机号格式不正确')
			return
		}

		setIsSendingCode(true)
		try {
			// 第一步：获取图形验证码 token
			const captchaResult = await bilibiliApi.getPhoneLoginCaptchaToken()
			if (captchaResult.isErr()) {
				toastAndLogError(
					'获取验证码失败',
					captchaResult.error,
					'PhoneLoginModal.getPhoneLoginCaptchaToken',
				)
				setIsSendingCode(false)
				return
			}
			const captcha = captchaResult.value
			// 第二步：跳转到 GEETEST 验证步骤
			setCaptchaParams({
				token: captcha.token,
				gt: captcha.geetest.gt,
				challenge: captcha.geetest.challenge,
				tel: trimmedTel,
				cid,
			})
			setStep('geetest_verify')
		} catch (error) {
			toastAndLogError(
				'获取验证码失败',
				error,
				'PhoneLoginModal.handleRequestCode',
			)
		}
		setIsSendingCode(false)
	}

	const handleGeetestMessage = async (event: WebViewMessageEvent) => {
		if (!captchaParams) return

		let parsed: { validate?: string; seccode?: string; challenge?: string }
		try {
			parsed = JSON.parse(event.nativeEvent.data) as typeof parsed
		} catch {
			return
		}

		const { validate, seccode, challenge } = parsed
		if (!validate || !seccode || !challenge) return

		// 第三步：使用 GEETEST 验证结果发送短信
		try {
			const smsResult = await bilibiliApi.sendPhoneLoginSms(
				captchaParams.tel,
				captchaParams.cid,
				captchaParams.token,
				challenge,
				validate,
				seccode,
			)
			if (smsResult.isErr()) {
				const errCode = smsResult.error.data.msgCode
				if (errCode === 86211 || errCode === -105) {
					setPhoneError('图形验证已过期，请重新获取验证码')
				} else {
					setPhoneError(smsResult.error.message || '发送验证码失败，请稍后重试')
				}
				setStep('input_phone')
				return
			}

			setCaptchaKey(smsResult.value.captcha_key)
			setStep('input_code')
			toast.success('验证码已发送', { id: 'phone-login-sms-sent' })
		} catch (error) {
			toastAndLogError(
				'发送验证码失败',
				error,
				'PhoneLoginModal.handleGeetestMessage',
			)
			setStep('input_phone')
		}
	}

	const handleLogin = async () => {
		setCodeError('')
		const trimmedCode = smsCode.trim()
		if (!trimmedCode) {
			setCodeError('请输入验证码')
			return
		}
		if (!/^\d{4,8}$/.test(trimmedCode)) {
			setCodeError('验证码格式不正确')
			return
		}

		setIsLoggingIn(true)
		try {
			const loginResult = await bilibiliApi.loginWithPhoneSmsCode(
				tel.trim(),
				cid,
				trimmedCode,
				captchaKey,
			)
			if (loginResult.isErr()) {
				setCodeError(loginResult.error.message || '登录失败，请检查验证码')
				setIsLoggingIn(false)
				return
			}

			const splitCookies = setCookieParser.splitCookiesString(
				loginResult.value,
			)
			const parsedCookie = setCookieParser.parse(splitCookies)
			const finalCookieObject = Object.fromEntries(
				parsedCookie.map((c) => [c.name, c.value]),
			)
			const result = setCookie(finalCookieObject)
			if (result.isErr()) {
				toast.error('保存 Cookie 失败：' + result.error.message)
				Sentry.captureException(result.error, {
					tags: { Component: 'PhoneLoginModal' },
				})
				setIsLoggingIn(false)
				return
			}

			setStep('success')
			toast.success('登录成功', { id: 'phone-login-success' })
			await queryClient.cancelQueries()
			await queryClient.invalidateQueries({
				queryKey: favoriteListQueryKeys.all,
			})
			await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
			setTimeout(() => close(), 1000)
		} catch (error) {
			toastAndLogError('登录失败', error, 'PhoneLoginModal.handleLogin')
		}
		setIsLoggingIn(false)
	}

	const renderInputPhoneStep = () => (
		<>
			<Dialog.Title>手机号登录</Dialog.Title>
			<Dialog.Content>
				<View style={styles.countryRow}>
					<Text
						variant='bodyMedium'
						style={styles.countryLabel}
					>
						国家/地区
					</Text>
					<Text variant='bodyMedium'>{selectedCountryLabel}</Text>
				</View>
				<View style={styles.countryPickerRow}>
					{COUNTRY_CODES.map((country) => (
						<Button
							key={country.value}
							mode={cid === country.value ? 'contained' : 'outlined'}
							onPress={() => setCid(country.value)}
							style={styles.countryButton}
							compact
						>
							+{country.value}
						</Button>
					))}
				</View>
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
				<Button onPress={close}>取消</Button>
				<Button
					mode='contained'
					onPress={handleRequestCode}
					loading={isSendingCode}
					disabled={isSendingCode}
				>
					获取验证码
				</Button>
			</Dialog.Actions>
		</>
	)

	const renderGeetestStep = () => {
		if (!captchaParams) return null
		return (
			<>
				<Dialog.Title>安全验证</Dialog.Title>
				<Dialog.Content style={styles.geetestContent}>
					<WebView
						style={styles.geetestWebView}
						source={{
							html: buildGeetestHtml(captchaParams.gt, captchaParams.challenge),
							baseUrl: 'https://www.bilibili.com',
						}}
						onMessage={handleGeetestMessage}
						javaScriptEnabled
						originWhitelist={['*']}
						mixedContentMode='always'
						startInLoadingState
						renderLoading={() => (
							<ActivityIndicator
								style={StyleSheet.absoluteFill}
								size='large'
							/>
						)}
					/>
				</Dialog.Content>
				<Dialog.Actions>
					<Button
						onPress={() => {
							setStep('input_phone')
							setCaptchaParams(null)
						}}
					>
						取消
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	const renderInputCodeStep = () => (
		<>
			<Dialog.Title>输入验证码</Dialog.Title>
			<Dialog.Content>
				<Text
					variant='bodyMedium'
					style={styles.description}
				>
					验证码已发送至 +{cid} {tel}
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
				<Button
					onPress={() => {
						setStep('input_phone')
						setSmsCode('')
						setCodeError('')
					}}
				>
					上一步
				</Button>
				<Button
					mode='contained'
					onPress={handleLogin}
					loading={isLoggingIn}
					disabled={isLoggingIn}
				>
					登录
				</Button>
			</Dialog.Actions>
		</>
	)

	const renderSuccessStep = () => (
		<>
			<Dialog.Title>登录成功</Dialog.Title>
			<Dialog.Content>
				<Text
					variant='bodyMedium'
					style={styles.description}
				>
					已成功登录 Bilibili 账号 🎉
				</Text>
			</Dialog.Content>
		</>
	)

	if (step === 'success') return renderSuccessStep()
	if (step === 'input_code') return renderInputCodeStep()
	if (step === 'geetest_verify') return renderGeetestStep()
	return renderInputPhoneStep()
}

const styles = StyleSheet.create({
	input: {
		marginTop: 8,
	},
	description: {
		marginBottom: 8,
	},
	countryRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	countryLabel: {
		opacity: 0.6,
	},
	countryPickerRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 4,
		marginBottom: 8,
	},
	countryButton: {
		minWidth: 56,
	},
	geetestContent: {
		padding: 0,
	},
	geetestWebView: {
		height: 280,
		borderRadius: 4,
	},
})
