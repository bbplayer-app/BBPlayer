import { alert } from '@/components/modals/AlertModal'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { Orpheus } from '@roitium/expo-orpheus'
import { useFocusEffect, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Switch, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function PlaybackSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()

	const [enablePersistCurrentPosition, setEnablePersistCurrentPosition] =
		useState(Orpheus.restorePlaybackPositionEnabled)
	const [enableLoudnessNormalization, setEnableLoudnessNormalization] =
		useState(Orpheus.loudnessNormalizationEnabled)
	const [enableAutostartPlayOnStart, setEnableAutostartPlayOnStart] = useState(
		Orpheus.autoplayOnStartEnabled,
	)
	const [isDesktopLyricsShown, setIsDesktopLyricsShown] = useState(
		Orpheus.isDesktopLyricsShown,
	)
	const [isDesktopLyricsLocked, setIsDesktopLyricsLocked] = useState(
		Orpheus.isDesktopLyricsLocked,
	)

	const enableDesktopLyrics = async () => {
		try {
			const hadPermission = await Orpheus.checkOverlayPermission()
			if (hadPermission) {
				await Orpheus.showDesktopLyrics()
				setIsDesktopLyricsShown(true)
				toast.success('启用成功。从下一首歌开始生效')
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
							setIsDesktopLyricsShown(true)
							toast.success('启用成功。从下一首歌开始生效')
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
		})
		return () => {
			listener.remove()
		}
	}, [])

	useFocusEffect(() => {
		setIsDesktopLyricsShown(Orpheus.isDesktopLyricsShown)
		setIsDesktopLyricsLocked(Orpheus.isDesktopLyricsLocked)
	})

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='播放设置' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + 20 },
				]}
			>
				<View style={styles.settingRow}>
					<Text>在应用启动时恢复上次播放进度</Text>
					<Switch
						value={enablePersistCurrentPosition}
						onValueChange={() => {
							try {
								Orpheus.restorePlaybackPositionEnabled =
									!enablePersistCurrentPosition
							} catch (e) {
								toastAndLogError('设置失败', e, 'Settings')
								return
							}
							setEnablePersistCurrentPosition(!enablePersistCurrentPosition)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>响度均衡（实验性）</Text>
					<Switch
						value={enableLoudnessNormalization}
						onValueChange={() => {
							try {
								Orpheus.loudnessNormalizationEnabled =
									!enableLoudnessNormalization
							} catch (e) {
								toastAndLogError('设置失败', e, 'Settings')
								return
							}
							setEnableLoudnessNormalization(!enableLoudnessNormalization)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>软件启动时自动播放（易社死）</Text>
					<Switch
						value={enableAutostartPlayOnStart}
						onValueChange={() => {
							try {
								Orpheus.autoplayOnStartEnabled = !enableAutostartPlayOnStart
							} catch (e) {
								toastAndLogError('设置失败', e, 'Settings')
								return
							}
							setEnableAutostartPlayOnStart(!enableAutostartPlayOnStart)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>桌面歌词</Text>
					<Switch
						value={isDesktopLyricsShown}
						onValueChange={async () => {
							try {
								if (isDesktopLyricsShown) {
									await Orpheus.hideDesktopLyrics()
								} else {
									await enableDesktopLyrics()
								}
							} catch (e) {
								toastAndLogError('设置失败', e, 'Settings')
								return
							}
							setIsDesktopLyricsShown(!isDesktopLyricsShown)
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
