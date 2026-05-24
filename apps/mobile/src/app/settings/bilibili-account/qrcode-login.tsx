import * as Sentry from '@sentry/react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useReducer } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import * as setCookieParser from 'set-cookie-parser'

import Button from '@/components/common/Button'
import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { userQueryKeys } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { BilibiliQrCodeLoginStatus } from '@/types/apis/bilibili'
import toast from '@/utils/toast'

type Status = 'generating' | 'polling' | 'expired' | 'success' | 'error'

interface State {
	status: Status
	statusText: string
	qrcodeKey: string
	qrcodeUrl: string
}

type Action =
	| { type: 'RESET' }
	| {
			type: 'GENERATE_SUCCESS'
			payload: { qrcode_key: string; url: string }
	  }
	| { type: 'GENERATE_FAILURE'; payload: string }
	| { type: 'POLL_UPDATE'; payload: { code: number } }
	| { type: 'LOGIN_SUCCESS' }

const initialState: State = {
	status: 'generating',
	statusText: '正在生成二维码...',
	qrcodeKey: '',
	qrcodeUrl: '',
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case 'RESET':
			return initialState
		case 'GENERATE_SUCCESS':
			return {
				...state,
				status: 'polling',
				statusText: '等待扫码',
				qrcodeKey: action.payload.qrcode_key,
				qrcodeUrl: action.payload.url,
			}
		case 'GENERATE_FAILURE':
			return {
				...state,
				status: 'error',
				statusText: `获取二维码失败: ${action.payload}`,
			}
		case 'POLL_UPDATE':
			switch (action.payload.code as BilibiliQrCodeLoginStatus) {
				case BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_WAIT:
					return { ...state, statusText: '等待扫码' }
				case BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_SCANNED_BUT_NOT_CONFIRMED:
					return { ...state, statusText: '等待确认' }
				case BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_QRCODE_EXPIRED:
					return {
						...state,
						status: 'expired',
						statusText: '二维码已过期，请重新生成',
						qrcodeKey: '',
						qrcodeUrl: '',
					}
				default:
					return state
			}
		case 'LOGIN_SUCCESS':
			return { ...state, status: 'success', statusText: '登录成功' }
	}
}

export default function QrCodeLoginPage() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { colors } = useTheme()
	const setCookie = useAppStore((state) => state.updateBilibiliCookie)
	const [state, dispatch] = useReducer(reducer, initialState)
	const { status, statusText, qrcodeKey, qrcodeUrl } = state

	useEffect(() => {
		if (status !== 'generating') return

		const generateQrCode = async () => {
			const response = await bilibiliApi.getLoginQrCode()
			if (response.isErr()) {
				dispatch({
					type: 'GENERATE_FAILURE',
					payload: String(response.error.message),
				})
				toast.error('获取二维码失败', { id: 'bilibili-qrcode-login-error' })
			} else {
				dispatch({ type: 'GENERATE_SUCCESS', payload: response.value })
			}
		}
		void generateQrCode()
	}, [status])

	useEffect(() => {
		if (status !== 'polling' || !qrcodeKey) return

		const interval = setInterval(async () => {
			const response = await bilibiliApi.pollQrCodeLoginStatus(qrcodeKey)
			if (response.isErr()) {
				toast.error('获取二维码登录状态失败', {
					id: 'bilibili-qrcode-login-status-error',
				})
				return
			}

			const pollData = response.value
			if (
				pollData.status ===
				BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_SUCCESS
			) {
				clearInterval(interval)
				dispatch({ type: 'LOGIN_SUCCESS' })

				const splitedCookie = setCookieParser.splitCookiesString(
					pollData.cookies,
				)
				const parsedCookie = setCookieParser.parse(splitedCookie)
				const finalCookieObject = Object.fromEntries(
					parsedCookie.map((c) => [c.name, c.value]),
				)
				const result = setCookie(finalCookieObject)
				if (result.isErr()) {
					toast.error('保存 Cookie 失败：' + result.error.message)
					Sentry.captureException(result.error, {
						tags: { Page: 'QrCodeLoginPage' },
					})
					return
				}
				toast.success('登录成功', { id: 'bilibili-qrcode-login-success' })
				await queryClient.cancelQueries()
				await queryClient.invalidateQueries({
					queryKey: favoriteListQueryKeys.all,
				})
				await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
				setTimeout(() => router.back(), 800)
			} else {
				dispatch({ type: 'POLL_UPDATE', payload: { code: pollData.status } })
			}
		}, 2000)

		return () => clearInterval(interval)
	}, [qrcodeKey, queryClient, router, setCookie, status])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='扫码登录 Bilibili' />
			</Appbar.Header>
			<View style={styles.content}>
				<Text
					variant='titleMedium'
					style={styles.statusText}
				>
					{statusText}
				</Text>
				{qrcodeUrl ? (
					<Pressable
						onPress={() => {
							WebBrowser.openBrowserAsync(qrcodeUrl).catch((e) => {
								void Clipboard.setStringAsync(qrcodeUrl)
								toast.error('无法调用浏览器打开网页，已将链接复制到剪贴板', {
									description: String(e),
								})
							})
						}}
						style={styles.qrcode}
					>
						<QRCode
							value={qrcodeUrl}
							size={220}
						/>
					</Pressable>
				) : null}
				<Text
					variant='bodyMedium'
					style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}
				>
					使用 Bilibili 客户端扫码确认。点击二维码可以尝试直接打开登录链接。
				</Text>
				{status === 'expired' || status === 'error' ? (
					<Button
						mode='contained'
						onPress={() => dispatch({ type: 'RESET' })}
					>
						重新生成
					</Button>
				) : null}
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
		alignItems: 'center',
		justifyContent: 'center',
		gap: 20,
		paddingHorizontal: 24,
	},
	statusText: {
		textAlign: 'center',
	},
	qrcode: {
		padding: 16,
		backgroundColor: '#fff',
		borderRadius: 8,
	},
})
