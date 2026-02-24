import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
	PermissionsAndroid,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { Appbar, Checkbox, Switch, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import useAppStore from '@/hooks/stores/useAppStore'

export default function AppearanceSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()

	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
	)
	const enableSpectrumVisualizer = useAppStore(
		(state) => state.settings.enableSpectrumVisualizer,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const [playerBGMenuVisible, setPlayerBGMenuVisible] = useState(false)
	const [nowPlayerBarMenuVisible, setNowPlayerBarMenuVisible] = useState(false)

	const setNowPlayingBarStyle = (style: 'float' | 'bottom') => {
		setSettings({ nowPlayingBarStyle: style })
		setNowPlayerBarMenuVisible(false)
	}

	const setPlayerBackgroundStyle = (style: 'gradient' | 'md3') => {
		setSettings({ playerBackgroundStyle: style })
		setPlayerBGMenuVisible(false)
	}

	const handleSpectrumToggle = () => {
		if (enableSpectrumVisualizer) {
			setSettings({ enableSpectrumVisualizer: false })
			return
		}

		if (Platform.OS === 'android') {
			void PermissionsAndroid.check(
				PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
			).then((hasPermission) => {
				if (hasPermission) {
					setSettings({ enableSpectrumVisualizer: true })
				} else {
					alert(
						'需要麦克风权限',
						'音频频谱功能需要访问麦克风以分析音频数据。这不会录制任何声音。\n\n开启后，封面将变为圆形。',
						[
							{ text: '取消' },
							{
								text: '确认',
								onPress: () => {
									void PermissionsAndroid.request(
										PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
									).then((granted) => {
										if (granted === PermissionsAndroid.RESULTS.GRANTED) {
											setSettings({ enableSpectrumVisualizer: true })
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
			setSettings({ enableSpectrumVisualizer: true })
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
					{ paddingBottom: insets.bottom + 20 },
				]}
			>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>显示音频频谱</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							开启后封面将变为圆形
						</Text>
					</View>
					<Switch
						value={enableSpectrumVisualizer}
						onValueChange={handleSpectrumToggle}
					/>
				</View>

				{Platform.OS === 'android' && (
					<View style={styles.settingRow}>
						<Text>选择底部播放条样式</Text>
						<FunctionalMenu
							visible={nowPlayerBarMenuVisible}
							onDismiss={() => setNowPlayerBarMenuVisible(false)}
							anchor={
								<IconButton
									icon='palette'
									size={20}
									onPress={() => setNowPlayerBarMenuVisible(true)}
								/>
							}
						>
							<Checkbox.Item
								mode='ios'
								label='悬浮（默认）'
								status={
									nowPlayingBarStyle === 'float' ? 'checked' : 'unchecked'
								}
								onPress={() => setNowPlayingBarStyle('float')}
							/>
							<Checkbox.Item
								mode='ios'
								label='沉浸'
								status={
									nowPlayingBarStyle === 'bottom' ? 'checked' : 'unchecked'
								}
								onPress={() => setNowPlayingBarStyle('bottom')}
							/>
						</FunctionalMenu>
					</View>
				)}
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
