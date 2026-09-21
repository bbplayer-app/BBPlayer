import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { type MenuEntry, useMenuActions } from '@/hooks/ui/useMenuActions'

const DOWNLOAD_PARALLEL_OPTIONS = [
	{ value: 1, label: '1 个（稳妥）' },
	{ value: 2, label: '2 个' },
	{ value: 3, label: '3 个' },
	{ value: 6, label: '6 个（最快）' },
] as const

export default function DownloadSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const setSettings = useAppStore((state) => state.setSettings)
	const haveTrack = useCurrentTrack()

	const downloadMaxParallelTasks = useAppStore(
		(state) => state.settings.downloadMaxParallelTasks,
	)

	const menuActions = useMenuActions(
		DOWNLOAD_PARALLEL_OPTIONS.map(
			(option): MenuEntry => ({
				title: option.label,
				state: downloadMaxParallelTasks === option.value ? 'on' : 'off',
				onPress: () => {
					setSettings({ downloadMaxParallelTasks: option.value })
				},
			}),
		),
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='下载设置' />
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
						<Text>同时下载数量</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							当前 {downloadMaxParallelTasks} 个
						</Text>
					</View>
					<MenuView {...menuActions}>
						<IconButton
							icon='download-multiple'
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
