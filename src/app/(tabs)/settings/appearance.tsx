import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Checkbox,
	IconButton,
	Switch,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import useAppStore from '@/hooks/stores/useAppStore'

export default function AppearanceSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()

	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)
	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
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
})
