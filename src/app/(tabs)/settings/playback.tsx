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
							Orpheus.setRestorePlaybackPositionEnabled(
								!enablePersistCurrentPosition,
							)
							setEnablePersistCurrentPosition(!enablePersistCurrentPosition)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>响度均衡（实验性）</Text>
					<Switch
						value={enableLoudnessNormalization}
						onValueChange={() => {
							Orpheus.setLoudnessNormalizationEnabled(
								!enableLoudnessNormalization,
							)
							setEnableLoudnessNormalization(!enableLoudnessNormalization)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>软件启动时自动播放（易社死）</Text>
					<Switch
						value={enableAutostartPlayOnStart}
						onValueChange={() => {
							Orpheus.setAutoplayOnStartEnabled(!enableAutostartPlayOnStart)
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
