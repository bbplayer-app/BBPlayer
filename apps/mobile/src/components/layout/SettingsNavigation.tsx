import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const sections = [
	{ title: '外观与主题', path: '/settings/appearance', icon: 'palette' },
	{ title: '播放', path: '/settings/playback', icon: 'play-circle-outline' },
	{ title: 'CDN 设置', path: '/settings/cdn', icon: 'cloud-outline' },
	{ title: '歌词', path: '/settings/lyrics', icon: 'text' },
	{ title: '下载与存储', path: '/settings/storage', icon: 'database-outline' },
	{ title: '数据与备份', path: '/settings/backup', icon: 'backup-restore' },
	{ title: '通用', path: '/settings/general', icon: 'cog-outline' },
	{ title: '关于', path: '/settings/about', icon: 'information-outline' },
	{ title: '支持与捐赠', path: '/settings/donate', icon: 'heart-outline' },
] as const

export default function SettingsNavigation({
	routeName,
}: {
	routeName: string
}) {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	return (
		<View
			style={{ width: 240, paddingTop: insets.top + 24, paddingHorizontal: 8 }}
		>
			<Text
				variant='titleLarge'
				style={{ paddingHorizontal: 16, marginBottom: 16 }}
			>
				设置
			</Text>
			{sections.map((section) => {
				const selected = `/${routeName}`.startsWith(section.path)
				return (
					<List.Item
						key={section.path}
						title={section.title}
						titleNumberOfLines={2}
						left={(props) => (
							<List.Icon
								{...props}
								icon={section.icon}
							/>
						)}
						onPress={() => router.navigate(section.path)}
						accessibilityState={{ selected }}
						style={{
							borderRadius: 16,
							backgroundColor: selected
								? colors.secondaryContainer
								: 'transparent',
						}}
					/>
				)
			})}
		</View>
	)
}
