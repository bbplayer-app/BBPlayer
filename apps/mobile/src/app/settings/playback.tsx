import { Orpheus } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, RadioButton, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import UniversalSwitch from '@/components/common/UniversalSwitch'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { toastAndLogError } from '@/utils/error-handling'

export default function PlaybackSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const allowSimultaneousPlayback = useAppStore(
		(state) => state.settings.allowSimultaneousPlayback,
	)
	const defaultPlayerMode = useAppStore(
		(state) => state.settings.defaultPlayerMode,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const [enablePersistCurrentPosition, setEnablePersistCurrentPosition] =
		useState(Orpheus.restorePlaybackPositionEnabled)
	const [enableLoudnessNormalization, setEnableLoudnessNormalization] =
		useState(Orpheus.loudnessNormalizationEnabled)
	const [enableAutostartPlayOnStart, setEnableAutostartPlayOnStart] = useState(
		Orpheus.autoplayOnStartEnabled,
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
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<View style={{ marginTop: 16 }}>
					<Text variant='titleMedium'>默认播放器</Text>
					<Text variant='bodySmall'>
						仅影响之后开始的播放，歌单可单独设置偏好。
					</Text>
					<RadioButton.Group
						value={defaultPlayerMode}
						onValueChange={(value) => {
							if (value === 'music' || value === 'podcast')
								setSettings({ defaultPlayerMode: value })
						}}
					>
						<RadioButton.Item
							label='音乐'
							value='music'
						/>
						<RadioButton.Item
							label='播客'
							value='podcast'
						/>
					</RadioButton.Group>
				</View>
				<View style={styles.settingRow}>
					<Text>在应用启动时恢复上次播放进度</Text>
					<UniversalSwitch
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
					<UniversalSwitch
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
					<UniversalSwitch
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
					<Text>允许与其他软件同时播放</Text>
					<UniversalSwitch
						value={allowSimultaneousPlayback}
						onValueChange={(value) => {
							setSettings({ allowSimultaneousPlayback: value })
						}}
					/>
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
