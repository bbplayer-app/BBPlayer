import { toastAndLogError } from '@/utils/error-handling'
import { Orpheus } from '@roitium/expo-orpheus'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
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
								Orpheus.setRestorePlaybackPositionEnabled(
									!enablePersistCurrentPosition,
								)
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
								Orpheus.setLoudnessNormalizationEnabled(
									!enableLoudnessNormalization,
								)
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
								Orpheus.setAutoplayOnStartEnabled(!enableAutostartPlayOnStart)
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
									await Orpheus.showDesktopLyrics()
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
						onValueChange={async () => {
							try {
								await Orpheus.setDesktopLyricsLocked(!isDesktopLyricsLocked)
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
