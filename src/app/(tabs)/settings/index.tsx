import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/stores/playerHooks/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { checkForAppUpdate } from '@/lib/services/updateService'
import type { RootStackParamList } from '@/types/navigation'
import { toastAndLogError } from '@/utils/log'
import toast from '@/utils/toast'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Application from 'expo-application'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as Updates from 'expo-updates'
import * as WebBrowser from 'expo-web-browser'
import { memo, useCallback, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Divider, IconButton, Switch, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CLICK_TIMES = 3
const updateTime = Updates.createdAt
	? `${Updates.createdAt.getFullYear()}-${Updates.createdAt.getMonth() + 1}-${Updates.createdAt.getDate()}`
	: ''

export default function SettingsPage() {
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const colors = useTheme().colors

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background,
			}}
		>
			<View
				style={{
					flex: 1,
					paddingTop: insets.top + 8,
					paddingBottom: currentTrack ? 70 : insets.bottom,
				}}
			>
				<View
					style={{
						paddingHorizontal: 25,
						paddingBottom: 20,
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<Text
						variant='headlineSmall'
						style={{ fontWeight: 'bold' }}
					>
						设置
					</Text>
				</View>
				<ScrollView
					style={{
						flex: 1,
					}}
					contentContainerStyle={{
						paddingHorizontal: 25,
					}}
					contentInsetAdjustmentBehavior='automatic'
				>
					<SettingsSection />
					<Divider style={{ marginTop: 16, marginBottom: 16 }} />
					<AboutSection />
				</ScrollView>
			</View>
			<View
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
				}}
			>
				<NowPlayingBar />
			</View>
		</View>
	)
}

const AboutSection = memo(function AboutSection() {
	const navigation =
		useNavigation<NativeStackNavigationProp<RootStackParamList>>()
	const [clickTimes, setClickTimes] = useState(0)

	const handlePress = useCallback(() => {
		const next = clickTimes + 1
		setClickTimes(next)
		if (next >= CLICK_TIMES) {
			navigation.navigate('Test')
			setTimeout(() => {
				setClickTimes(0)
			}, 200)
			return
		}
	}, [clickTimes, navigation])

	return (
		<View style={{ paddingBottom: 15 }}>
			<Text
				variant='titleLarge'
				style={{ textAlign: 'center', marginBottom: 5 }}
				onPress={handlePress}
			>
				BBPlayer
			</Text>
			<Text
				variant='bodySmall'
				style={{ textAlign: 'center', marginBottom: 5 }}
			>
				v{Application.nativeApplicationVersion}:{Application.nativeBuildVersion}{' '}
				{Updates.updateId
					? `(hotfix-${Updates.updateId.slice(0, 7)}-${updateTime})`
					: ''}
			</Text>

			<Text
				variant='bodyMedium'
				style={{ textAlign: 'center' }}
			>
				又一个 BiliBili 音乐播放器
			</Text>
			<Text
				variant='bodyMedium'
				style={{ textAlign: 'center', marginTop: 8 }}
			>
				官网：
				<Text
					variant='bodyMedium'
					onPress={() =>
						WebBrowser.openBrowserAsync('https://bbplayer.roitium.com').catch(
							(e) => {
								void Clipboard.setStringAsync('https://bbplayer.roitium.com')
								toast.error('无法调用浏览器打开网页，已将链接复制到剪贴板', {
									description: String(e),
								})
							},
						)
					}
					style={{ textDecorationLine: 'underline' }}
				>
					https://bbplayer.roitium.com
				</Text>
			</Text>
		</View>
	)
})

AboutSection.displayName = 'AboutSection'

const SettingsSection = memo(function SettingsSection() {
	const navigation = useNavigation()
	const setSendPlayHistory = useAppStore(
		(state) => state.setEnableSendPlayHistory,
	)
	const sendPlayHistory = useAppStore((state) => state.settings.sendPlayHistory)
	const setEnableSentryReport = useAppStore(
		(state) => state.setEnableSentryReport,
	)
	const enableSentryReport = useAppStore(
		(state) => state.settings.enableSentryReport,
	)
	const setEnableDebugLog = useAppStore((state) => state.setEnableDebugLog)
	const enableDebugLog = useAppStore((state) => state.settings.enableDebugLog)
	const openModal = useModalStore((state) => state.open)
	const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false)

	const handleCheckForUpdate = async () => {
		setIsCheckingForUpdate(true)
		try {
			const result = await checkForAppUpdate()
			if (result.isErr()) {
				toast.error('检查更新失败', { description: result.error.message })
				setIsCheckingForUpdate(false)
				return
			}

			const { update } = result.value
			if (update) {
				if (update.forced) {
					openModal('UpdateApp', update, { dismissible: false })
				} else {
					openModal('UpdateApp', update)
				}
			} else {
				toast.success('已是最新版本')
			}
		} catch (e) {
			toast.error('检查更新时发生未知错误', { description: String(e) })
		}
		setIsCheckingForUpdate(false)
	}

	const shareLogFile = async () => {
		const d = new Date()
		const dateString = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
		const file = new FileSystem.File(
			FileSystem.Paths.document,
			'logs',
			`${dateString}.log`,
		)
		if (file.exists) {
			await Sharing.shareAsync(file.uri)
		} else {
			toastAndLogError('', new Error('无法分享日志：未找到日志文件'), 'UI.Test')
		}
	}

	return (
		<View style={{ flexDirection: 'column' }}>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>向 bilibili 上报观看进度</Text>
				<Switch
					value={sendPlayHistory}
					onValueChange={setSendPlayHistory}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>向 Sentry 上报错误</Text>
				<Switch
					value={enableSentryReport}
					onValueChange={setEnableSentryReport}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>打开 Debug 日志</Text>
				<Switch
					value={enableDebugLog}
					onValueChange={setEnableDebugLog}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>手动设置 Cookie</Text>
				<IconButton
					icon='open-in-new'
					size={20}
					onPress={() => openModal('CookieLogin', undefined)}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>重新扫码登录</Text>
				<IconButton
					icon='open-in-new'
					size={20}
					onPress={() => openModal('QRCodeLogin', undefined)}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>分享今日运行日志</Text>
				<IconButton
					icon='share-variant'
					size={20}
					onPress={shareLogFile}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>检查更新</Text>
				<IconButton
					icon='update'
					size={20}
					loading={isCheckingForUpdate}
					onPress={handleCheckForUpdate}
				/>
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginTop: 16,
				}}
			>
				<Text>开发者页面</Text>
				<IconButton
					icon='open-in-new'
					size={20}
					onPress={() => navigation.navigate('Test')}
				/>
			</View>
		</View>
	)
})

SettingsSection.displayName = 'SettingsSection'
