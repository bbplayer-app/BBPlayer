import { Orpheus, type AudioQualityPreference } from '@bbplayer/orpheus'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Icon,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { useSettingsSplit } from '@/components/layout/SettingsNavigation'
import {
	formatAudioQualityLabel,
	getAudioQualityOption,
} from '@/constants/audioQuality'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import { LIST_ITEM_BORDER_RADIUS } from '@/theme/dimensions'
import { toastAndLogError } from '@/utils/error-handling'

export default function PlaybackSettingsPage() {
	const router = useRouter()
	const split = useSettingsSplit()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const allowSimultaneousPlayback = useAppStore(
		(state) => state.settings.allowSimultaneousPlayback,
	)

	const openModal = useModalStore((state) => state.open)
	const openedModalCount = useModalStore((state) => state.modals.length)
	const canConfigureAudioQuality = Platform.OS === 'android'

	const [audioQuality, setAudioQuality] = useState<AudioQualityPreference>(
		() => (canConfigureAudioQuality ? Orpheus.preferredAudioQuality : 'high'),
	)

	const syncAudioQuality = useCallback(() => {
		if (!canConfigureAudioQuality) return
		setAudioQuality(Orpheus.preferredAudioQuality)
	}, [canConfigureAudioQuality])

	useFocusEffect(
		useCallback(() => {
			syncAudioQuality()
		}, [syncAudioQuality]),
	)

	useEffect(() => {
		syncAudioQuality()
	}, [openedModalCount, syncAudioQuality])

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

	const audioQualityLabel = formatAudioQualityLabel(audioQuality)

	const audioQualityDescription =
		getAudioQualityOption(audioQuality).description

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
				{!split && <Appbar.BackAction onPress={() => router.back()} />}
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
				{canConfigureAudioQuality && (
					<TouchableRipple
						testID='playback-audio-quality'
						borderless
						style={styles.audioQualityRow}
						onPress={() => openModal('AudioQuality', undefined)}
					>
						<View style={styles.audioQualityRowContent}>
							<View style={styles.settingDescription}>
								<Text>首选音质</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									{audioQualityDescription}
								</Text>
							</View>
							<View style={styles.audioQualityValue}>
								<Text
									variant='labelLarge'
									numberOfLines={1}
								>
									{audioQualityLabel}
								</Text>
								<Icon
									source='chevron-right'
									size={20}
								/>
							</View>
						</View>
					</TouchableRipple>
				)}
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
	settingDescription: {
		flex: 1,
		flexShrink: 1,
		marginEnd: 12,
	},
	audioQualityRow: {
		marginTop: 16,
		marginHorizontal: -12,
		borderRadius: LIST_ITEM_BORDER_RADIUS,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	audioQualityRowContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	audioQualityValue: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 0,
		gap: 2,
	},
})
