import FunctionalMenu from '@/components/common/FunctionalMenu'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { Orpheus } from '@roitium/expo-orpheus'
import * as Application from 'expo-application'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import * as Updates from 'expo-updates'
import * as WebBrowser from 'expo-web-browser'
import { memo, useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Checkbox,
	Divider,
	IconButton,
	Switch,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CLICK_TIMES = 3
const updateTime = Updates.createdAt
	? `${Updates.createdAt.getFullYear()}-${Updates.createdAt.getMonth() + 1}-${Updates.createdAt.getDate()}`
	: ''

export default function SettingsPage() {
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const colors = useTheme().colors

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<View
				style={{
					flex: 1,
					paddingTop: insets.top + 8,
					paddingBottom: haveTrack ? 70 : insets.bottom,
				}}
			>
				<View style={styles.header}>
					<Text
						variant='headlineSmall'
						style={styles.title}
					>
						设置
					</Text>
				</View>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					contentInsetAdjustmentBehavior='automatic'
				>
					<SettingsSection />
					<Divider style={styles.divider} />
					<AboutSection />
				</ScrollView>
			</View>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

const AboutSection = memo(function AboutSection() {
	const router = useRouter()
	const [clickTimes, setClickTimes] = useState(0)

	const handlePress = useCallback(() => {
		const next = clickTimes + 1
		setClickTimes(next)
		if (next >= CLICK_TIMES) {
			router.push('/test')
			setTimeout(() => {
				setClickTimes(0)
			}, 200)
			return
		}
	}, [clickTimes, router])

	return (
		<View style={styles.aboutSectionContainer}>
			<Text
				variant='titleLarge'
				style={styles.aboutTitle}
				onPress={handlePress}
			>
				BBPlayer
			</Text>
			<Text
				variant='bodySmall'
				style={styles.aboutVersion}
			>
				v{Application.nativeApplicationVersion}:{Application.nativeBuildVersion}{' '}
				{Updates.updateId
					? `(hotfix-${Updates.updateId.slice(0, 7)}-${updateTime})`
					: ''}
			</Text>

			<Text
				variant='bodyMedium'
				style={styles.aboutSubtitle}
			>
				又一个{'\u2009Bilibili\u2009'}音乐播放器
			</Text>
			<Text
				variant='bodyMedium'
				style={styles.aboutWebsite}
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
					style={styles.aboutWebsiteLink}
				>
					https://bbplayer.roitium.com
				</Text>
			</Text>
		</View>
	)
})

AboutSection.displayName = 'AboutSection'

const SettingsSection = memo(function SettingsSection() {
	const router = useRouter()
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
	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)
	const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false)
	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const [playerBGMenuVisible, setPlayerBGMenuVisible] = useState(false)
	const [enablePersistCurrentPosition, setEnablePersistCurrentPosition] =
		useState(Orpheus.restorePlaybackPositionEnabled)
	const [enableLoudnessNormalization, setEnableLoudnessNormalization] =
		useState(Orpheus.loudnessNormalizationEnabled)

	const setSettings = useAppStore((state) => state.setSettings)

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

	const setPlayerBackgroundStyle = (style: 'gradient' | 'streamer' | 'md3') => {
		setSettings({ playerBackgroundStyle: style })
		setPlayerBGMenuVisible(false)
	}

	return (
		<View style={styles.settingsSectionContainer}>
			<View style={styles.settingRow}>
				<Text>向{'\u2009Bilibili\u2009'}上报观看进度</Text>
				<Switch
					value={sendPlayHistory}
					onValueChange={() =>
						setSettings({ sendPlayHistory: !sendPlayHistory })
					}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>向{'\u2009Sentry\u2009'}上报错误</Text>
				<Switch
					value={enableSentryReport}
					onValueChange={setEnableSentryReport}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>打开{'\u2009Debug\u2009'}日志</Text>
				<Switch
					value={enableDebugLog}
					onValueChange={setEnableDebugLog}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>恢复旧版歌词样式</Text>
				<Switch
					value={enableOldSchoolStyleLyric}
					onValueChange={() =>
						setSettings({
							enableOldSchoolStyleLyric: !enableOldSchoolStyleLyric,
						})
					}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>在应用启动时恢复上次播放进度</Text>
				<Switch
					value={enablePersistCurrentPosition}
					onValueChange={() => {
						Orpheus.setRestorePlaybackPositionEnabled(
							!enablePersistCurrentPosition,
						)
						setEnablePersistCurrentPosition(!enablePersistCurrentPosition)
					}}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>选择播放器背景样式</Text>
				<FunctionalMenu
					visible={playerBGMenuVisible}
					onDismiss={() => setPlayerBGMenuVisible(false)}
					anchor={
						<IconButton
							icon='palette'
							size={20}
							onPress={() => setPlayerBGMenuVisible(true)}
						/>
					}
				>
					<Checkbox.Item
						mode='ios'
						label='渐变'
						status={
							playerBackgroundStyle === 'gradient' ? 'checked' : 'unchecked'
						}
						onPress={() => setPlayerBackgroundStyle('gradient')}
					/>
					<Checkbox.Item
						mode='ios'
						label='默认背景'
						status={playerBackgroundStyle === 'md3' ? 'checked' : 'unchecked'}
						onPress={() => setPlayerBackgroundStyle('md3')}
					/>
				</FunctionalMenu>
			</View>
			<View style={styles.settingRow}>
				<Text>响度均衡（实验性）</Text>
				<Switch
					value={enableLoudnessNormalization}
					onValueChange={() => {
						Orpheus.setLoudnessNormalizationEnabled(
							!enableLoudnessNormalization,
						)
						setEnableLoudnessNormalization(!enableLoudnessNormalization)
					}}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>手动设置{'\u2009Cookie'}</Text>
				<IconButton
					icon='open-in-new'
					size={20}
					onPress={() => openModal('CookieLogin', undefined)}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>重新扫码登录</Text>
				<IconButton
					icon='open-in-new'
					size={20}
					onPress={() => openModal('QRCodeLogin', undefined)}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>分享今日运行日志</Text>
				<IconButton
					icon='share-variant'
					size={20}
					onPress={shareLogFile}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>检查更新</Text>
				<IconButton
					icon='update'
					size={20}
					loading={isCheckingForUpdate}
					onPress={handleCheckForUpdate}
				/>
			</View>
			<View style={styles.settingRow}>
				<Text>开发者页面</Text>
				<IconButton
					icon='open-in-new'
					size={20}
					onPress={() => router.push('/test')}
				/>
			</View>
		</View>
	)
})

SettingsSection.displayName = 'SettingsSection'

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 25,
		paddingBottom: 20,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	title: {
		fontWeight: 'bold',
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 25,
	},
	divider: {
		marginTop: 16,
		marginBottom: 16,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
	aboutSectionContainer: {
		paddingBottom: 15,
	},
	aboutTitle: {
		textAlign: 'center',
		marginBottom: 5,
	},
	aboutVersion: {
		textAlign: 'center',
		marginBottom: 5,
	},
	aboutSubtitle: {
		textAlign: 'center',
	},
	aboutWebsite: {
		textAlign: 'center',
		marginTop: 8,
	},
	aboutWebsiteLink: {
		textDecorationLine: 'underline',
	},
	settingsSectionContainer: {
		flexDirection: 'column',
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
})
