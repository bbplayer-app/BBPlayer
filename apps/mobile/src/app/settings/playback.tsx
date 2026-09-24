import { Orpheus } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
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

	const setDefaultPlayerMode = (mode: 'music' | 'podcast') => {
		setSettings({ defaultPlayerMode: mode })
	}

	const menuActions = useMenuActions([
		{
			title: '音乐',
			state: defaultPlayerMode === 'music' ? 'on' : 'off',
			onPress: () => setDefaultPlayerMode('music'),
		},
		{
			title: '播客',
			state: defaultPlayerMode === 'podcast' ? 'on' : 'off',
			onPress: () => setDefaultPlayerMode('podcast'),
		},
	])

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
				<SettingsSectionTitle
					title='播放行为'
					first
				/>
				<View style={styles.settingRow}>
					<View style={{ flexShrink: 1 }}>
						<Text>默认播放器</Text>
						<Text variant='bodySmall'>
							仅影响之后开始的播放，歌单可单独设置偏好。
						</Text>
					</View>
					<MenuView {...menuActions}>
						<IconButton
							icon='chevron-down'
							size={20}
						/>
					</MenuView>
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
					<Text>允许与其他软件同时播放</Text>
					<UniversalSwitch
						value={allowSimultaneousPlayback}
						onValueChange={(value) => {
							setSettings({ allowSimultaneousPlayback: value })
						}}
					/>
				</View>

				<SettingsSectionTitle title='启动时行为' />
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
