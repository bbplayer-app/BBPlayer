import type {
	NativeBottomTabNavigationEventMap,
	NativeBottomTabNavigationOptions,
} from '@bottom-tabs/react-navigation'
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation'
import Icon from '@react-native-vector-icons/material-design-icons'
import { withLayoutContext } from 'expo-router'
import type {
	ParamListBase,
	TabNavigationState,
} from 'expo-router/react-navigation'
import { useTheme } from 'react-native-paper'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

const BottomTabNavigator = createNativeBottomTabNavigator().Navigator

const Tabs = withLayoutContext<
	NativeBottomTabNavigationOptions,
	typeof BottomTabNavigator,
	TabNavigationState<ParamListBase>,
	NativeBottomTabNavigationEventMap
>(BottomTabNavigator)

interface nonNullableIcon {
	uri: string
	scale: number
}

const searchIcon = Icon.getImageSourceSync('magnify', 24) as nonNullableIcon
const libraryIcon = Icon.getImageSourceSync('bookshelf', 24) as nonNullableIcon
const profileIcon = Icon.getImageSourceSync('account', 24) as nonNullableIcon

export default function TabLayout() {
	const themes = useTheme().colors
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const skinIcons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons
	const useSkinTabs = Boolean(
		skinIcons?.home.default &&
		skinIcons.home.selected &&
		skinIcons.library.default &&
		skinIcons.library.selected &&
		skinIcons.settings.default &&
		skinIcons.settings.selected,
	)

	return (
		<Tabs
			disablePageAnimations
			disableTintColor={useSkinTabs}
			iconSize={useSkinTabs ? 50 : undefined}
			tabBarActiveTintColor={themes.primary}
			activeIndicatorColor={
				useSkinTabs ? 'transparent' : themes.secondaryContainer
			}
			tabBarStyle={{ backgroundColor: themes.elevation.level1 }}
			initialRouteName='index'
		>
			<Tabs.Screen
				name='index'
				options={{
					title: '搜索',
					tabBarIcon: ({ focused }) => {
						// 旧皮肤仍使用 home 作为第一个标签的图标槽位。
						const icon = focused
							? skinIcons?.home.selected
							: skinIcons?.home.default
						return icon ? { uri: icon, scale: 1 } : searchIcon
					},
					tabBarLabel: '搜索',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='library/[tab]'
				options={{
					title: '音乐库',
					tabBarIcon: ({ focused }) => {
						const icon = focused
							? skinIcons?.library.selected
							: skinIcons?.library.default
						return icon ? { uri: icon, scale: 1 } : libraryIcon
					},
					tabBarLabel: '音乐库',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='my'
				options={{
					title: '我的',
					tabBarIcon: ({ focused }) => {
						// 旧皮肤仍使用 settings 作为第三个标签的图标槽位。
						const icon = focused
							? skinIcons?.settings.selected
							: skinIcons?.settings.default
						return icon ? { uri: icon, scale: 1 } : profileIcon
					},
					tabBarLabel: '我的',
					lazy: true,
				}}
			/>
		</Tabs>
	)
}
