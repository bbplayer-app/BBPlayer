import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

import SettingsNavigation, {
	SettingsSplitProvider,
} from '@/components/layout/SettingsNavigation'
import { useResponsiveLayout } from '@/hooks/ui/useResponsiveLayout'

export default function SettingsLayout() {
	const { colors } = useTheme()
	const { isExpanded } = useResponsiveLayout()

	// 无论是否分栏都保持同一棵树，旋转屏幕时设置页的导航栈不会被重建。
	return (
		<View style={[styles.row, { backgroundColor: colors.background }]}>
			{isExpanded && (
				<>
					<SettingsNavigation />
					<View
						style={[styles.divider, { backgroundColor: colors.outlineVariant }]}
					/>
				</>
			)}
			<View style={styles.detail}>
				<SettingsSplitProvider value={isExpanded}>
					<Stack
						screenOptions={{
							headerShown: false,
							// 分栏时只有右侧详情在切换，淡入比整页滑入更贴近「原地切换」。
							animation: isExpanded ? 'fade' : undefined,
						}}
					/>
				</SettingsSplitProvider>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	row: { flex: 1, flexDirection: 'row' },
	divider: { width: StyleSheet.hairlineWidth },
	detail: { flex: 1, minWidth: 0 },
})
