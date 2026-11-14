import { useNavigation, usePathname, useRouter } from 'expo-router'
import { createContext, useContext } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const SETTINGS_SECTIONS = [
	{
		title: '外观与主题',
		path: '/settings/appearance',
		route: 'appearance/index',
		icon: 'palette',
	},
	{
		title: '播放',
		path: '/settings/playback',
		route: 'playback',
		icon: 'play-circle-outline',
	},
	{
		title: 'CDN 设置',
		path: '/settings/cdn',
		route: 'cdn',
		icon: 'cloud-outline',
	},
	{ title: '歌词', path: '/settings/lyrics', route: 'lyrics', icon: 'text' },
	{
		title: '下载与存储',
		path: '/settings/storage',
		route: 'storage',
		icon: 'database-outline',
	},
	{
		title: '数据与备份',
		path: '/settings/backup',
		route: 'backup',
		icon: 'backup-restore',
	},
	{
		title: '通用',
		path: '/settings/general',
		route: 'general',
		icon: 'cog-outline',
	},
	{
		title: '关于',
		path: '/settings/about',
		route: 'about',
		icon: 'information-outline',
	},
	{
		title: '支持与捐赠',
		path: '/settings/donate',
		route: 'donate',
		icon: 'heart-outline',
	},
] as const

const SettingsSplitContext = createContext(false)
export const SettingsSplitProvider = SettingsSplitContext

/**
 * 设置页是否以「侧栏 + 详情」分栏展示。分栏时各分区页面本身就是根页面，
 * 不应再显示返回按钮，由侧栏标题的返回按钮离开整个设置页。
 */
export function useSettingsSplit() {
	return useContext(SettingsSplitContext)
}

export const SETTINGS_NAVIGATION_WIDTH = 280

export default function SettingsNavigation() {
	const router = useRouter()
	// 侧栏渲染在设置页的布局里，这里拿到的是根导航栈，返回会直接离开设置页。
	const navigation = useNavigation()
	const pathname = usePathname()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: colors.background }]}
			contentContainerStyle={{
				paddingTop: insets.top,
				paddingBottom: insets.bottom + 16,
			}}
		>
			<View style={styles.header}>
				<Appbar.BackAction
					onPress={() => navigation.goBack()}
					accessibilityLabel='返回'
					testID='settings-navigation-back'
				/>
				<Text variant='titleLarge'>设置</Text>
			</View>
			{SETTINGS_SECTIONS.map((section) => {
				const selected = pathname.startsWith(section.path)

				return (
					<List.Item
						key={section.path}
						title={section.title}
						titleNumberOfLines={2}
						left={(props) => (
							<List.Icon
								{...props}
								icon={section.icon}
								color={
									selected
										? colors.onSecondaryContainer
										: colors.onSurfaceVariant
								}
							/>
						)}
						onPress={() => {
							if (pathname === section.path) return
							// 分区之间是平级切换：替换当前分区而不是压栈，
							// 这样返回键会直接离开设置页，而不是逐个回退访问过的分区。
							router.replace(section.path)
						}}
						accessibilityRole='tab'
						accessibilityState={{ selected }}
						titleStyle={
							selected ? { color: colors.onSecondaryContainer } : undefined
						}
						style={[
							styles.item,
							{
								backgroundColor: selected
									? colors.secondaryContainer
									: 'transparent',
							},
						]}
					/>
				)
			})}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		width: SETTINGS_NAVIGATION_WIDTH,
		flexGrow: 0,
	},
	header: {
		height: 64,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 8,
	},
	item: {
		marginHorizontal: 12,
		borderRadius: 28,
		paddingVertical: 4,
	},
})
