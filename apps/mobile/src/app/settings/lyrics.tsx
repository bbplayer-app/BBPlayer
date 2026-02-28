import { Orpheus } from '@bbplayer/orpheus'
import { useFocusEffect, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Checkbox, Switch, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useAppStore } from '@/hooks/stores/useAppStore'
import { toastAndLogError } from '@/utils/error-handling'
import { setDesktopLyrics } from '@/utils/player'
import toast from '@/utils/toast'

export default function LyricsSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const [isDesktopLyricsShown, setIsDesktopLyricsShown] = useState(
		Orpheus.isDesktopLyricsShown,
	)
	const [isDesktopLyricsLocked, setIsDesktopLyricsLocked] = useState(
		Orpheus.isDesktopLyricsLocked,
	)
	const [isStatusBarLyricsEnabled, setIsStatusBarLyricsEnabled] = useState(
		Orpheus.isStatusBarLyricsEnabled,
	)
	const [isSuperLyricApiEnabled, setIsSuperLyricApiEnabled] = useState(
		Orpheus.isSuperLyricApiEnabled,
	)

	const lyricSource = useAppStore((state) => state.settings.lyricSource)
	const enableVerbatimLyrics = useAppStore(
		(state) => state.settings.enableVerbatimLyrics,
	)
	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const [lyricSourceMenuVisible, setLyricSourceMenuVisible] = useState(false)

	const enableDesktopLyrics = async () => {
		try {
			const hadPermission = await Orpheus.checkOverlayPermission()
			if (hadPermission) {
				await Orpheus.showDesktopLyrics()
				setIsDesktopLyricsShown(true)
				// 立即推送当前正在播放的歌词，不等下一首
				const currentTrack = await Orpheus.getCurrentTrack()
				if (currentTrack) {
					setDesktopLyrics(currentTrack.id, 0)
				}
				return
			}
			alert(
				'桌面歌词',
				'启用桌面歌词需要启用悬浮窗权限。跳转到设置后，请找到 BBPlayer，并允许显示悬浮窗',
				[
					{
						text: '去设置',
						onPress: async () => {
							await Orpheus.requestOverlayPermission()
						},
					},
					{ text: '取消' },
				],
				{ cancelable: true },
			)
		} catch (e) {
			toastAndLogError('设置桌面歌词失败', e, 'Settings')
			return
		}
	}

	useEffect(() => {
		const listener = AppState.addEventListener('change', () => {
			setIsDesktopLyricsShown(Orpheus.isDesktopLyricsShown)
			setIsDesktopLyricsLocked(Orpheus.isDesktopLyricsLocked)
			setIsStatusBarLyricsEnabled(Orpheus.isStatusBarLyricsEnabled)
			setIsSuperLyricApiEnabled(Orpheus.isSuperLyricApiEnabled)
		})
		return () => {
			listener.remove()
		}
	}, [])

	useFocusEffect(() => {
		setIsDesktopLyricsShown(Orpheus.isDesktopLyricsShown)
		setIsDesktopLyricsLocked(Orpheus.isDesktopLyricsLocked)
		setIsStatusBarLyricsEnabled(Orpheus.isStatusBarLyricsEnabled)
		setIsSuperLyricApiEnabled(Orpheus.isSuperLyricApiEnabled)
	})

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
				<View style={styles.settingRow}>
					<Text>显示逐字歌词</Text>
					<Switch
						value={enableVerbatimLyrics}
						onValueChange={() =>
							setSettings({ enableVerbatimLyrics: !enableVerbatimLyrics })
						}
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
				{Platform.OS === 'android' && (
					<>
						<View style={styles.settingRow}>
							<Text>桌面歌词</Text>
							<Switch
								value={isDesktopLyricsShown}
								onValueChange={async () => {
									try {
										if (isDesktopLyricsShown) {
											await Orpheus.hideDesktopLyrics()
											setIsDesktopLyricsShown(false)
										} else {
											await enableDesktopLyrics()
										}
									} catch (e) {
										toastAndLogError('设置失败', e, 'Settings')
										return
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<Text>桌面歌词锁定</Text>
							<Switch
								value={isDesktopLyricsLocked}
								onValueChange={() => {
									try {
										Orpheus.isDesktopLyricsLocked = !isDesktopLyricsLocked
									} catch (e) {
										toastAndLogError('设置失败', e, 'Settings')
										return
									}
									setIsDesktopLyricsLocked(!isDesktopLyricsLocked)
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<Text
								style={!isSuperLyricApiEnabled ? { opacity: 0.4 } : undefined}
							>
								状态栏歌词
								{!isSuperLyricApiEnabled ? '（需安装 SuperLyric 模块）' : ''}
							</Text>
							<Switch
								disabled={!isSuperLyricApiEnabled}
								value={isStatusBarLyricsEnabled}
								onValueChange={async () => {
									try {
										const next = !isStatusBarLyricsEnabled
										Orpheus.isStatusBarLyricsEnabled = next
										setIsStatusBarLyricsEnabled(next)
										if (next) {
											// 立即推送当前歌词
											const currentTrack = await Orpheus.getCurrentTrack()
											if (currentTrack) {
												setDesktopLyrics(currentTrack.id, 0)
											}
										}
									} catch (e) {
										toastAndLogError('设置失败', e, 'Settings')
									}
								}}
							/>
						</View>
					</>
				)}
				<View style={styles.settingRow}>
					<Text>自动匹配的歌词源（不影响手动搜索）</Text>
					<FunctionalMenu
						visible={lyricSourceMenuVisible}
						onDismiss={() => setLyricSourceMenuVisible(false)}
						anchor={
							<IconButton
								icon='playlist-music'
								size={20}
								onPress={() => setLyricSourceMenuVisible(true)}
							/>
						}
					>
						<Checkbox.Item
							mode='ios'
							label='网易云音乐'
							status={lyricSource === 'netease' ? 'checked' : 'unchecked'}
							onPress={() => {
								setSettings({ lyricSource: 'netease' })
								setLyricSourceMenuVisible(false)
							}}
						/>
						<Checkbox.Item
							mode='ios'
							label='QQ 音乐'
							status={lyricSource === 'qqmusic' ? 'checked' : 'unchecked'}
							onPress={() => {
								setSettings({ lyricSource: 'qqmusic' })
								setLyricSourceMenuVisible(false)
							}}
						/>
						<Checkbox.Item
							mode='ios'
							label='酷狗音乐'
							status={lyricSource === 'kugou' ? 'checked' : 'unchecked'}
							onPress={() => {
								setSettings({ lyricSource: 'kugou' })
								setLyricSourceMenuVisible(false)
							}}
						/>
						<Checkbox.Item
							mode='ios'
							label='自动 (选择最先返回的数据源)'
							status={lyricSource === 'auto' ? 'checked' : 'unchecked'}
							onPress={() => {
								setSettings({ lyricSource: 'auto' })
								setLyricSourceMenuVisible(false)
								toast.info(
									'「自动」的意思是：选择最先返回的数据源，但不会考虑匹配度，所以不保证结果一定是最好的',
								)
							}}
						/>
					</FunctionalMenu>
				</View>
			</ScrollView>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
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
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
