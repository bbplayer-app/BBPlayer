import { Orpheus, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import { MenuView } from '@expo/ui/community/menu'
import { useRouter } from 'expo-router'
import {
	PermissionsAndroid,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'

export default function AppearanceSettingsPage() {
	const router = useRouter()
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
	const enableMinimalistMode = useAppStore(
		(state) => state.settings.enableMinimalistMode,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const handleSpectrumToggle = () => {
		if (enableSpectrumVisualizer) {
			Orpheus.isSpectrumVisualizerEnabled = false
			return
		}

		if (Platform.OS === 'android') {
			void PermissionsAndroid.check(
				PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
			).then((hasPermission) => {
				if (hasPermission) {
					Orpheus.isSpectrumVisualizerEnabled = true
				} else {
					alert(
						'需要麦克风权限',
						'音频频谱功能需要访问麦克风以分析音频数据。这不会录制任何声音。',
						[
							{ text: '取消' },
							{
								text: '确认',
								onPress: () => {
									void PermissionsAndroid.request(
										PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
									).then((granted) => {
										if (granted === PermissionsAndroid.RESULTS.GRANTED) {
											Orpheus.isSpectrumVisualizerEnabled = true
										}
									})
								},
							},
						],
						{ cancelable: true },
					)
				}
			})
		} else {
			Orpheus.isSpectrumVisualizerEnabled = true
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='外观设置' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>显示音频频谱</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							在播放器封面周围显示实时音频频谱
						</Text>
					</View>
					<UniversalSwitch
						value={enableSpectrumVisualizer}
						onValueChange={handleSpectrumToggle}
					/>
				</View>

				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>清爽模式</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							开启后主页仅显示顶部搜索框，隐藏其他推荐及历史组件
						</Text>
					</View>
					<UniversalSwitch
						value={enableMinimalistMode}
						onValueChange={(value) =>
							setSettings({ enableMinimalistMode: value })
						}
					/>
				</View>

				{Platform.OS === 'android' && (
					<View style={styles.settingRow}>
						<Text>选择底部播放条样式</Text>
						<MenuView
							actions={[
								{
									id: 'float',
									title: '悬浮（默认）',
									state: nowPlayingBarStyle === 'float' ? 'on' : 'off',
								},
								{
									id: 'bottom',
									title: '沉浸',
									state: nowPlayingBarStyle === 'bottom' ? 'on' : 'off',
								},
							]}
							onPressAction={({ nativeEvent }) =>
								setSettings({
									nowPlayingBarStyle: nativeEvent.event as 'float' | 'bottom',
								})
							}
						>
							<IconButton
								icon='palette'
								size={20}
							/>
						</MenuView>
					</View>
				)}
				<View style={styles.settingRow}>
					<Text>选择播放器背景样式</Text>
					<MenuView
						actions={[
							{
								id: 'gradient',
								title: '普通渐变',
								state: playerBackgroundStyle === 'gradient' ? 'on' : 'off',
							},
							{
								id: 'fluid',
								title: '流体效果',
								state: playerBackgroundStyle === 'fluid' ? 'on' : 'off',
							},
						]}
						onPressAction={({ nativeEvent }) =>
							setSettings({
								playerBackgroundStyle: nativeEvent.event as
									| 'gradient'
									| 'fluid',
							})
						}
					>
						<IconButton
							icon='palette'
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
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
})
