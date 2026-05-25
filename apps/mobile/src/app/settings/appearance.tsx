import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
	PermissionsAndroid,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import UniversalCheckboxItem from '@/components/common/UniversalCheckboxItem'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

export default function AppearanceSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const activeSkin = useActiveSkin()

	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
	)
	const enableSpectrumVisualizer = useAppStore(
		(state) => state.settings.enableSpectrumVisualizer,
	)
	const enableMinimalistMode = useAppStore(
		(state) => state.settings.enableMinimalistMode,
	)
	const activeSkinId = useAppStore((state) => state.settings.activeSkinId)
	const useSkinJsBottomTabs = useAppStore(
		(state) => state.settings.useSkinJsBottomTabs,
	)
	const playFullSkinBootSplashAnimation = useAppStore(
		(state) => state.settings.playFullSkinBootSplashAnimation,
	)
	const selectedSkinBootSplashAssetId = useAppStore(
		(state) => state.settings.selectedSkinBootSplashAssetId,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const [playerBGMenuVisible, setPlayerBGMenuVisible] = useState(false)
	const [nowPlayerBarMenuVisible, setNowPlayerBarMenuVisible] = useState(false)
	const [bootSplashMenuVisible, setBootSplashMenuVisible] = useState(false)

	const setNowPlayingBarStyle = (style: 'float' | 'bottom') => {
		setSettings({ nowPlayingBarStyle: style })
		setNowPlayerBarMenuVisible(false)
	}

	const setPlayerBackgroundStyle = (style: 'gradient' | 'md3') => {
		setSettings({ playerBackgroundStyle: style })
		setPlayerBGMenuVisible(false)
	}

	const selectedBootSplashAsset =
		activeSkin?.bootSplash.items.find(
			(item) => item.id === selectedSkinBootSplashAssetId,
		) ?? activeSkin?.bootSplash.items[0]

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
							开启后封面将变为圆形
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

				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>MyGO!!!!! 晴空向光行主题</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							开启后底栏按钮替换为 MyGO!!!!! 联动专属吉他/猫耳图标
						</Text>
					</View>
					<UniversalSwitch
						value={activeSkinId === 'mygo-sunny-sky'}
						onValueChange={(value) =>
							setSettings({
								activeSkinId: value ? 'mygo-sunny-sky' : null,
								enableMygoTheme: value,
							})
						}
					/>
				</View>

				{activeSkinId && (
					<View style={styles.settingRow}>
						<View style={styles.settingTextContainer}>
							<Text>使用皮肤底栏背景</Text>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								开启后使用 JS 底栏展示主题背景，可随时切回原生底栏
							</Text>
						</View>
						<UniversalSwitch
							value={useSkinJsBottomTabs}
							onValueChange={(value) => {
								setSettings({ useSkinJsBottomTabs: value })
								alert('需要重启应用', '底栏渲染方式会在下次启动时生效。', [
									{ text: '知道了' },
								])
							}}
						/>
					</View>
				)}

				{activeSkinId && activeSkin ? (
					<View style={styles.settingRow}>
						<View style={styles.settingTextContainer}>
							<Text>启动动画素材</Text>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								{selectedBootSplashAsset?.name ?? '默认素材'}
							</Text>
						</View>
						<FunctionalMenu
							visible={bootSplashMenuVisible}
							onDismiss={() => setBootSplashMenuVisible(false)}
							title='启动动画素材'
							anchor={
								<IconButton
									icon='chevron-down'
									onPress={() => setBootSplashMenuVisible(true)}
								/>
							}
						>
							{activeSkin.bootSplash.items.map((item) => (
								<FunctionalMenu.Item
									key={item.id}
									title={item.name}
									status={
										item.id === selectedBootSplashAsset?.id
											? 'checked'
											: 'unchecked'
									}
									onPress={() => {
										setSettings({ selectedSkinBootSplashAssetId: item.id })
										setBootSplashMenuVisible(false)
									}}
								/>
							))}
						</FunctionalMenu>
					</View>
				) : null}

				{activeSkinId && (
					<View style={styles.settingRow}>
						<View style={styles.settingTextContainer}>
							<Text>完整播放主题启动动画</Text>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								关闭时应用加载完成后立即淡出启动动画
							</Text>
						</View>
						<UniversalSwitch
							value={playFullSkinBootSplashAnimation}
							onValueChange={(value) =>
								setSettings({ playFullSkinBootSplashAnimation: value })
							}
						/>
					</View>
				)}

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
							<UniversalCheckboxItem
								mode='ios'
								label='悬浮（默认）'
								status={
									nowPlayingBarStyle === 'float' ? 'checked' : 'unchecked'
								}
								onPress={() => setNowPlayingBarStyle('float')}
							/>
							<UniversalCheckboxItem
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
						<UniversalCheckboxItem
							mode='ios'
							label='渐变'
							status={
								playerBackgroundStyle === 'gradient' ? 'checked' : 'unchecked'
							}
							onPress={() => setPlayerBackgroundStyle('gradient')}
						/>
						<UniversalCheckboxItem
							mode='ios'
							label='默认背景'
							status={playerBackgroundStyle === 'md3' ? 'checked' : 'unchecked'}
							onPress={() => setPlayerBackgroundStyle('md3')}
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
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
