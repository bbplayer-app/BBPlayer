import * as Sentry from '@sentry/react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useReducer } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme, Icon } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import * as setCookieParser from 'set-cookie-parser'

import ActivityIndicator from '@/components/common/ActivityIndicator'
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
					return { ...state, statusText: '已扫码，等待确认' }
				case BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_QRCODE_EXPIRED:
					return {
						...state,
						status: 'expired',
						statusText: '二维码已过期',
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
			const response = await bilibiliApi.pollQrCodeLoginStatus({ qrcodeKey })
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

	const handleOpenLink = () => {
		if (!qrcodeUrl) return
		WebBrowser.openBrowserAsync(qrcodeUrl).catch((e) => {
			void Clipboard.setStringAsync(qrcodeUrl)
			toast.error('无法调用浏览器打开网页，已将链接复制到剪贴板', {
				description: String(e),
			})
		})
	}

	const getDotColor = () => {
		switch (status) {
			case 'generating':
				return colors.primary
			case 'polling':
				return statusText.includes('确认') ? '#4CAF50' : '#FFB300'
			case 'success':
				return '#4CAF50'
			case 'expired':
			case 'error':
				return colors.error
			default:
				return colors.outline
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='扫码登录 Bilibili' />
			</Appbar.Header>
			<View style={styles.content}>
				<View style={styles.brandHeader}>
					<Icon
						source='television-play'
						size={48}
					/>
					<Text
						variant='headlineSmall'
						style={styles.brandTitle}
					>
						Bilibili 扫码登录
					</Text>
				</View>

				<View
					style={[
						styles.card,
						{
							backgroundColor: colors.elevation.level1,
							borderColor: colors.outlineVariant,
						},
					]}
				>
					<View style={styles.statusRow}>
						<View
							style={[styles.statusDot, { backgroundColor: getDotColor() }]}
						/>
						<Text
							variant='titleMedium'
							style={[styles.statusText, { color: colors.onSurface }]}
						>
							{statusText}
						</Text>
					</View>

					<View style={styles.qrcodeWrapper}>
						{qrcodeUrl ? (
							<Pressable
								onPress={handleOpenLink}
								style={styles.qrcodePressable}
							>
								<QRCode
									value={qrcodeUrl}
									size={200}
								/>
							</Pressable>
						) : (
							<View style={styles.qrcodePlaceholder}>
								<ActivityIndicator
									size='large'
									color={colors.primary}
								/>
							</View>
						)}

						{(status === 'expired' || status === 'error') && (
							<View
								style={[
									styles.overlay,
									{ backgroundColor: 'rgba(0,0,0,0.75)' },
								]}
							>
								<Icon
									source='alert-circle-outline'
									size={48}
								/>
								<Text
									variant='titleMedium'
									style={styles.overlayText}
								>
									{status === 'expired' ? '二维码已失效' : '获取失败'}
								</Text>
								<Button
									mode='contained'
									onPress={() => dispatch({ type: 'RESET' })}
									style={styles.refreshButton}
								>
									刷新二维码
								</Button>
							</View>
						)}
					</View>
				</View>

				{qrcodeUrl && (status === 'polling' || status === 'success') ? (
					<Button
						mode='contained'
						onPress={handleOpenLink}
						style={styles.brandButton}
						contentStyle={styles.brandButtonContent}
						labelStyle={styles.brandButtonLabel}
						icon='open-in-new'
					>
						在 Bilibili 客户端打开
					</Button>
				) : null}

				<Text
					variant='bodyMedium'
					style={[styles.hintText, { color: colors.onSurfaceVariant }]}
				>
					请使用 Bilibili 客户端扫描上方二维码。
					{'\n'}
					若处于同一台设备，可点击按钮直接跳转 B 站进行确认。
				</Text>
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
		paddingHorizontal: 24,
		gap: 24,
	},
	brandHeader: {
		alignItems: 'center',
		gap: 10,
		marginBottom: 8,
	},
	brandTitle: {
		fontWeight: 'bold',
	},
	card: {
		borderRadius: 24,
		padding: 24,
		borderWidth: 1,
		alignItems: 'center',
		gap: 20,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.05,
		shadowRadius: 12,
		width: '100%',
		maxWidth: 320,
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	statusDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	statusText: {
		fontWeight: 'bold',
	},
	qrcodeWrapper: {
		width: 220,
		height: 220,
		borderRadius: 16,
		overflow: 'hidden',
		backgroundColor: '#fff',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
		borderWidth: 1,
		borderColor: 'rgba(0,0,0,0.05)',
	},
	qrcodePressable: {
		padding: 10,
	},
	qrcodePlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	overlay: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		padding: 16,
	},
	overlayText: {
		color: '#fff',
		fontWeight: 'bold',
	},
	refreshButton: {
		borderRadius: 20,
	},
	brandButton: {
		width: '100%',
		maxWidth: 280,
	},
	brandButtonContent: {
		height: 48,
	},
	brandButtonLabel: {
		color: '#fff',
		fontWeight: 'bold',
	},
	hintText: {
		textAlign: 'center',
		lineHeight: 20,
	},
})
