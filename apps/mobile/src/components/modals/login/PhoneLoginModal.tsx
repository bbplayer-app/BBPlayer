import * as Sentry from '@sentry/react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, HelperText, Text, TextInput } from 'react-native-paper'
import * as setCookieParser from 'set-cookie-parser'

import Button from '@/components/common/Button'
import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { userQueryKeys } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

type Step = 'input_phone' | 'input_code' | 'success'

const COUNTRY_CODES = [
	{ label: '中国大陆 (+86)', value: '86' },
	{ label: '中国香港 (+852)', value: '852' },
	{ label: '中国台湾 (+886)', value: '886' },
	{ label: '美国/加拿大 (+1)', value: '1' },
	{ label: '日本 (+81)', value: '81' },
	{ label: '韩国 (+82)', value: '82' },
	{ label: '英国 (+44)', value: '44' },
]

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

			// 第二步：使用图形验证 token 发送短信
			// 注意：Bilibili 的短信发送接口需要 GEETEST 滑块验证码。
			// validate 和 seccode 在完整流程中应由用户完成 GEETEST 滑块后由 SDK 回调提供。
			// 由于本应用暂不内嵌 GEETEST SDK，此处先以空字符串尝试；
			// 若 Bilibili 返回 86211（需要图形验证），则引导用户前往浏览器完成验证后重试。
			const smsResult = await bilibiliApi.sendPhoneLoginSms(
				trimmedTel,
				cid,
				captcha.token,
				captcha.geetest.challenge,
				'',
				'',
			)
			if (smsResult.isErr()) {
				const errCode = smsResult.error.data.msgCode
				if (errCode === 86211 || errCode === -105) {
					// 需要图形验证码，引导用户完成后重试
					setPhoneError(
						'Bilibili 需要图形验证，请点击下方「在浏览器中完成验证」按钮',
					)
				} else {
					setPhoneError(smsResult.error.message || '发送验证码失败，请稍后重试')
				}
				setIsSendingCode(false)
				return
			}

			setCaptchaKey(smsResult.value.captcha_key)
			setStep('input_code')
			toast.success('验证码已发送', { id: 'phone-login-sms-sent' })
		} catch (error) {
			toastAndLogError(
				'发送验证码失败',
				error,
				'PhoneLoginModal.handleRequestCode',
			)
		}
		setIsSendingCode(false)
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

			const splitedCookie = setCookieParser.splitCookiesString(
				loginResult.value,
			)
			const parsedCookie = setCookieParser.parse(splitedCookie)
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

	const handleOpenBrowserForCaptcha = () => {
		const loginUrl = 'https://www.bilibili.com/login?source=main_mini_login'
		WebBrowser.openBrowserAsync(loginUrl).catch((e) => {
			void Clipboard.setStringAsync(loginUrl)
			toast.error('无法调用浏览器，已将链接复制到剪贴板', {
				description: String(e),
			})
		})
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
				{phoneError.includes('图形验证') ? (
					<Button
						mode='outlined'
						onPress={handleOpenBrowserForCaptcha}
						style={styles.browserButton}
					>
						在浏览器中完成验证后重新获取验证码
					</Button>
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
	browserButton: {
		marginTop: 12,
	},
})
