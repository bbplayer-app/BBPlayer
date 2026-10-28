import { Orpheus } from '@bbplayer/orpheus'
import { useFocusEffect, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useAppStore } from '@/hooks/stores/useAppStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import lyricService from '@/lib/services/lyricService'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

function applyStatusBarLyricsProvider(
	provider: 'superlyric' | 'lyricon' | 'meizu',
	syncStates: () => void,
) {
	try {
		Orpheus.statusBarLyricsProvider = provider
		syncStates()
	} catch (e) {
		toastAndLogError('设置失败', e, 'Settings')
	}
}

export default function LyricsSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const lyriconConnectionToast = useRef<string | number | null>(null)
	const finishLyriconConnectionToast = useCallback((connected = false) => {
		const id = lyriconConnectionToast.current
		if (id === null) return
		lyriconConnectionToast.current = null
		if (connected) {
			toast.success('已连接词幕', { id, duration: 2000 })
		} else {
			toast.dismiss(id)
		}
	}, [])

	const [isDesktopLyricsShown, setIsDesktopLyricsShown] = useState(
		Orpheus.isDesktopLyricsShown,
	)
	const [isDesktopLyricsLocked, setIsDesktopLyricsLocked] = useState(
		Orpheus.isDesktopLyricsLocked,
	)
	const [isStatusBarLyricsEnabled, setIsStatusBarLyricsEnabled] = useState(
		Orpheus.isStatusBarLyricsEnabled,
	)
	const [isCarLyricsEnabled, setIsCarLyricsEnabled] = useState(
		Orpheus.isCarLyricsEnabled,
	)
	const [isSuperLyricApiEnabled, setIsSuperLyricApiEnabled] = useState(
		Orpheus.isSuperLyricApiEnabled,
	)
	const [isLyriconApiEnabled, setIsLyriconApiEnabled] = useState(
		Orpheus.isLyriconApiEnabled,
	)
	const [statusBarLyricsProvider, setStatusBarLyricsProvider] = useState(
		Orpheus.statusBarLyricsProvider ?? 'lyricon',
	)

	const lyricSource = useAppStore((state) => state.settings.lyricSource)
	const enableVerbatimLyrics = useAppStore(
		(state) => state.settings.enableVerbatimLyrics,
	)
	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const isStatusBarLyricsProviderActive =
		statusBarLyricsProvider === 'lyricon'
			? isLyriconApiEnabled
			: statusBarLyricsProvider === 'meizu'
				? true
				: isSuperLyricApiEnabled
	const isLyriconConnecting =
		statusBarLyricsProvider === 'lyricon' &&
		isStatusBarLyricsEnabled &&
		!isLyriconApiEnabled

	const inactiveStatusBarLyricsProviderText =
		statusBarLyricsProvider === 'lyricon'
			? isLyriconConnecting
				? '（正在连接词幕…）'
				: '（未连接词幕模块）'
			: statusBarLyricsProvider === 'meizu'
				? '（仅支持 Flyme / 魅族状态栏歌词）'
				: '（需安装 SuperLyric 模块）'

	// Lyricon tries to connect when enabled; a failed attempt turns the setting off.
	const isStatusBarLyricsSwitchDisabled =
		statusBarLyricsProvider !== 'lyricon' && !isStatusBarLyricsProviderActive

	const syncStates = useCallback(async () => {
		if (
			Orpheus.statusBarLyricsProvider !== 'lyricon' ||
			!Orpheus.isStatusBarLyricsEnabled ||
			Orpheus.isLyriconApiEnabled
		) {
			finishLyriconConnectionToast(
				Orpheus.statusBarLyricsProvider === 'lyricon' &&
					Orpheus.isStatusBarLyricsEnabled &&
					Orpheus.isLyriconApiEnabled,
			)
		}
		const hasPermission = await Orpheus.checkOverlayPermission()
		// UI 开关仅在「设置开启」且「有权限」时显示为 ON
		setIsDesktopLyricsShown(Orpheus.isDesktopLyricsShown && hasPermission)
		setIsDesktopLyricsLocked(Orpheus.isDesktopLyricsLocked)
		setIsStatusBarLyricsEnabled(Orpheus.isStatusBarLyricsEnabled)
		setIsCarLyricsEnabled(Orpheus.isCarLyricsEnabled)
		setIsSuperLyricApiEnabled(Orpheus.isSuperLyricApiEnabled)
		setIsLyriconApiEnabled(Orpheus.isLyriconApiEnabled)
		setStatusBarLyricsProvider(Orpheus.statusBarLyricsProvider ?? 'lyricon')
	}, [finishLyriconConnectionToast])

	const providerMenu = useMenuActions([
		{
			title: `SuperLyric${!isSuperLyricApiEnabled ? '（未激活）' : ''}`,
			state: statusBarLyricsProvider === 'superlyric' ? 'on' : 'off',
			onPress: () => applyStatusBarLyricsProvider('superlyric', syncStates),
		},
		{
			title: `词幕 (Lyricon)${statusBarLyricsProvider === 'lyricon' && !isLyriconApiEnabled ? '（未连接）' : ''}`,
			state: statusBarLyricsProvider === 'lyricon' ? 'on' : 'off',
			onPress: () => applyStatusBarLyricsProvider('lyricon', syncStates),
		},
		{
			title: '魅族状态栏歌词',
			state: statusBarLyricsProvider === 'meizu' ? 'on' : 'off',
			onPress: () => applyStatusBarLyricsProvider('meizu', syncStates),
		},
	])

	const lyricSourceMenu = useMenuActions([
		{
			title: '网易云音乐',
			state: lyricSource === 'netease' ? 'on' : 'off',
			onPress: () => setSettings({ lyricSource: 'netease' }),
		},
		{
			title: 'QQ 音乐',
			state: lyricSource === 'qqmusic' ? 'on' : 'off',
			onPress: () => setSettings({ lyricSource: 'qqmusic' }),
		},
		{
			title: '酷狗音乐',
			state: lyricSource === 'kugou' ? 'on' : 'off',
			onPress: () => setSettings({ lyricSource: 'kugou' }),
		},
		{
			title: '自动 (选择最先返回的数据源)',
			state: lyricSource === 'auto' ? 'on' : 'off',
			onPress: () => {
				setSettings({ lyricSource: 'auto' })
				toast.info(
					'「自动」的意思是：选择最先返回的数据源，但不会考虑匹配度，所以不保证结果一定是最好的',
				)
			},
		},
	])

	const enableDesktopLyrics = async () => {
		try {
			const hasPermission = await Orpheus.checkOverlayPermission()
			if (hasPermission) {
				await Orpheus.showDesktopLyrics()
				void syncStates()
				// 立即推送当前正在播放的歌词，不等下一首
				const currentTrack = await Orpheus.getCurrentTrack()
				if (currentTrack) {
					void lyricService.pushLyricsToOverlays(currentTrack.id)
				}
				return
			}
			alert(
				'桌面歌词',
				'启用桌面歌词需要启用悬浮窗权限。跳转到设置后，请找到 BBPlayer，并允许显示悬浮窗',
				[
					{ text: '取消' },
					{
						text: '去设置',
						onPress: async () => {
							await Orpheus.requestOverlayPermission()
						},
					},
				],
				{ cancelable: true },
			)
		} catch (e) {
			toastAndLogError('设置桌面歌词失败', e, 'Settings')
		}
	}

	useEffect(() => {
		const listener = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				void syncStates()
			}
		})

		const statusListener = Orpheus.addListener(
			'onStatusBarLyricsStatusChanged',
			() => {
				void syncStates()
			},
		)

		return () => {
			listener.remove()
			statusListener.remove()
		}
	}, [syncStates])

	useFocusEffect(
		useCallback(() => {
			void syncStates()
			return () => finishLyriconConnectionToast()
		}, [syncStates, finishLyriconConnectionToast]),
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='歌词设置' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title='歌词显示'
					first
				/>
				<View style={styles.settingRow}>
					<Text>显示逐字歌词</Text>
					<UniversalSwitch
						value={enableVerbatimLyrics}
						onValueChange={() =>
							setSettings({ enableVerbatimLyrics: !enableVerbatimLyrics })
						}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>恢复旧版歌词样式</Text>
					<UniversalSwitch
						value={enableOldSchoolStyleLyric}
						onValueChange={() =>
							setSettings({
								enableOldSchoolStyleLyric: !enableOldSchoolStyleLyric,
							})
						}
					/>
				</View>
				{Platform.OS === 'android' && (
					<>
						<SettingsSectionTitle title='系统歌词（仅 Android）' />
						<View style={styles.settingRow}>
							<Text>桌面歌词</Text>
							<UniversalSwitch
								value={isDesktopLyricsShown}
								onValueChange={async () => {
									try {
										// 如果当前视觉上是开着的，点击必定是想关掉
										if (isDesktopLyricsShown) {
											await Orpheus.hideDesktopLyrics()
											void syncStates()
										} else {
											// 如果当前视觉上是关着的（可能是没权限，也可能是设置就是关的）
											// 我们统一走 enable 流程（含权限检查）
											await enableDesktopLyrics()
										}
									} catch (e) {
										toastAndLogError('设置失败', e, 'Settings')
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<Text>桌面歌词锁定</Text>
							<UniversalSwitch
								value={isDesktopLyricsLocked}
								onValueChange={async () => {
									try {
										Orpheus.isDesktopLyricsLocked = !isDesktopLyricsLocked
										await syncStates()
									} catch (e) {
										toastAndLogError('设置失败', e, 'Settings')
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<View style={{ flex: 1, marginRight: 16 }}>
								<Text>车载歌词</Text>
								<Text
									style={{
										fontSize: 12,
										opacity: 0.55,
										marginTop: 4,
									}}
								>
									启用后会把当前歌词显示到媒体信息的标题部分
								</Text>
							</View>
							<UniversalSwitch
								value={isCarLyricsEnabled}
								onValueChange={async () => {
									try {
										const next = !isCarLyricsEnabled
										Orpheus.isCarLyricsEnabled = next
										await syncStates()
										if (next) {
											const currentTrack = await Orpheus.getCurrentTrack()
											if (currentTrack) {
												void lyricService.pushLyricsToOverlays(currentTrack.id)
											}
										}
									} catch (e) {
										toastAndLogError('设置失败', e, 'Settings')
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<Text>状态栏歌词框架</Text>
							<MenuView {...providerMenu}>
								<IconButton
									icon='playlist-music'
									size={20}
								/>
							</MenuView>
						</View>
						<View style={styles.settingRow}>
							<View style={{ flex: 1, marginRight: 16 }}>
								<Text
									style={
										isStatusBarLyricsSwitchDisabled
											? { opacity: 0.4 }
											: undefined
									}
								>
									状态栏歌词
									{!isStatusBarLyricsProviderActive
										? inactiveStatusBarLyricsProviderText
										: ''}
								</Text>
								{!isStatusBarLyricsProviderActive && !isLyriconConnecting && (
									<Text
										style={{
											fontSize: 12,
											opacity: 0.5,
											marginTop: 4,
											color: colors.primary,
											textDecorationLine: 'underline',
										}}
										onPress={() =>
											WebBrowser.openBrowserAsync(
												'https://bbplayer.roitium.com/guides/lyrics.html#status-bar-lyric',
											)
										}
									>
										{statusBarLyricsProvider === 'lyricon'
											? '开启时尝试连接，失败后自动关闭。点击查看配置文档'
											: '未检测到可用环境，请点击查看配置文档'}
									</Text>
								)}
							</View>
							<UniversalSwitch
								disabled={isStatusBarLyricsSwitchDisabled}
								value={isStatusBarLyricsEnabled}
								onValueChange={async () => {
									try {
										const next = !isStatusBarLyricsEnabled
										if (statusBarLyricsProvider === 'lyricon' && next) {
											lyriconConnectionToast.current = toast.loading(
												'正在连接词幕…',
												{
													id: lyriconConnectionToast.current ?? undefined,
													duration: Infinity,
												},
											)
										} else {
											finishLyriconConnectionToast()
										}
										setIsStatusBarLyricsEnabled(next)
										Orpheus.isStatusBarLyricsEnabled = next
										await syncStates()
										if (next) {
											// 立即推送当前歌词
											const currentTrack = await Orpheus.getCurrentTrack()
											if (currentTrack) {
												void lyricService.pushLyricsToOverlays(currentTrack.id)
											}
										}
									} catch (e) {
										finishLyriconConnectionToast()
										setIsStatusBarLyricsEnabled(
											Orpheus.isStatusBarLyricsEnabled,
										)
										toastAndLogError('设置失败', e, 'Settings')
									}
								}}
							/>
						</View>
					</>
				)}
				<SettingsSectionTitle title='歌词来源' />
				<View style={styles.settingRow}>
					<Text>自动匹配的歌词源（不影响手动搜索）</Text>
					<MenuView {...lyricSourceMenu}>
						<IconButton
							icon='playlist-music'
							size={20}
						/>
					</MenuView>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 25,
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
})
