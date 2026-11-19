import { Orpheus, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { useSettingsSplit } from '@/components/layout/SettingsNavigation'
import ThemeSection from '@/features/theme/ThemeSection'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'

export default function AppearanceSettingsPage() {
	const router = useRouter()
	const split = useSettingsSplit()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const playerBackgroundStyle = useAppStore((state) =>
		state.settings.playerBackgroundStyle === 'fluid' ? 'fluid' : 'gradient',
	)

	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
	)

	const enableSpectrumVisualizer = useSpectrumVisualizerEnabled()
	const setSettings = useAppStore((state) => state.setSettings)

	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)

	const nowPlayingBarStyleMenu = useMenuActions([
		{
			title: '悬浮（默认）',
			state: nowPlayingBarStyle === 'float' ? 'on' : 'off',
			onPress: () => setSettings({ nowPlayingBarStyle: 'float' }),
		},
		{
			title: '沉浸',
			state: nowPlayingBarStyle === 'bottom' ? 'on' : 'off',
			onPress: () => setSettings({ nowPlayingBarStyle: 'bottom' }),
		},
	])

	const playerBackgroundStyleMenu = useMenuActions([
		{
			title: '流体效果（默认）',
			state: playerBackgroundStyle === 'fluid' ? 'on' : 'off',
			onPress: () => setSettings({ playerBackgroundStyle: 'fluid' }),
		},
		{
			title: '普通渐变',
			state: playerBackgroundStyle === 'gradient' ? 'on' : 'off',
			onPress: () => setSettings({ playerBackgroundStyle: 'gradient' }),
		},
	])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				{!split && <Appbar.BackAction onPress={() => router.back()} />}
				<Appbar.Content title='外观与主题' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title='显示'
					first
				/>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>纯白背景</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							仅用于墨水屏
						</Text>
					</View>
					<UniversalSwitch
						value={pureWhiteBackground}
						onValueChange={(value) =>
							setSettings({ pureWhiteBackground: value })
						}
						testID='pure-white-background-switch'
					/>
				</View>
				<SettingsSectionTitle title='播放器' />
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>显示音频频谱</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							在播放器封面周围显示实时音频频谱。
							{Platform.OS === 'android' &&
								'开启频谱会暂停使用 offload；切换时播放可能短暂停顿。'}
						</Text>
					</View>
					<UniversalSwitch
						value={enableSpectrumVisualizer}
						onValueChange={(value) => {
							Orpheus.isSpectrumVisualizerEnabled = value
						}}
					/>
				</View>
				{Platform.OS === 'android' && (
					<View style={styles.settingRow}>
						<Text>选择底部播放条样式</Text>
						<MenuView {...nowPlayingBarStyleMenu}>
							<IconButton
								icon='palette'
								size={20}
							/>
						</MenuView>
					</View>
				)}
				<View style={styles.settingRow}>
					<Text>选择播放器背景样式</Text>
					<MenuView {...playerBackgroundStyleMenu}>
						<IconButton
							icon='palette'
							size={20}
						/>
					</MenuView>
				</View>

				<SettingsSectionTitle title='主题' />
				<ThemeSection disabled={pureWhiteBackground} />
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
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
})
