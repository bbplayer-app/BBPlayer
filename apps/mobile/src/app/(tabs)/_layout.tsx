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

import useAppStore from '@/hooks/stores/useAppStore'

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

const homeIcon = Icon.getImageSourceSync('home', 24) as nonNullableIcon
const libraryIcon = Icon.getImageSourceSync('bookshelf', 24) as nonNullableIcon
const settingsIcon = Icon.getImageSourceSync('cog', 24) as nonNullableIcon

const mygoHomeIcon = {
	uri: 'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip/1778313795001/skin/tail_icon_maina48e8a6cfb89d919886ee48322c941a4fe56e5da.png',
	scale: 20,
}
const mygoHomeSelectedIcon = {
	uri: 'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip/1778313795001/skin/tail_icon_selected_mainac88137c851531822e33556afc83d03bd1bb0876.png',
	scale: 3,
}
const mygoLibraryIcon = {
	uri: 'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip/1778313795001/skin/tail_icon_channel33db6b1cf80090febb31b2ce2701f073aa38137a.png',
	scale: 3,
}
const mygoLibrarySelectedIcon = {
	uri: 'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip/1778313795001/skin/tail_icon_selected_channel6a9346c3f798f45a7cb5ba6df10ef346a0052bc4.png',
	scale: 3,
}
const mygoSettingsIcon = {
	uri: 'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip/1778313795001/skin/tail_icon_myselfe0a704681ccad23e7c88624e8b866ad52220b4fa.png',
	scale: 3,
}
const mygoSettingsSelectedIcon = {
	uri: 'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip/1778313795001/skin/tail_icon_selected_myself469938039b3438a5fa734cdb13a4a3a7ccdde99c.png',
	scale: 3,
}

export default function TabLayout() {
	const themes = useTheme().colors
	const enableMygoTheme = useAppStore((state) => state.settings.enableMygoTheme)

	return (
		<Tabs
			disablePageAnimations
			tabBarActiveTintColor={themes.primary}
			activeIndicatorColor={themes.primaryContainer}
			tabBarStyle={{ backgroundColor: themes.elevation.level1 }}
			initialRouteName='index'
		>
			<Tabs.Screen
				name='index'
				options={{
					title: '主页',
					tabBarIcon: ({ focused }) =>
						enableMygoTheme
							? focused
								? mygoHomeSelectedIcon
								: mygoHomeIcon
							: homeIcon,
					tabBarLabel: '主页',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='library/[tab]'
				options={{
					title: '音乐库',
					tabBarIcon: ({ focused }) =>
						enableMygoTheme
							? focused
								? mygoLibrarySelectedIcon
								: mygoLibraryIcon
							: libraryIcon,
					tabBarLabel: '音乐库',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='settings/index'
				options={{
					title: '设置',
					tabBarIcon: ({ focused }) =>
						enableMygoTheme
							? focused
								? mygoSettingsSelectedIcon
								: mygoSettingsIcon
							: settingsIcon,
					tabBarLabel: '设置',
					lazy: true,
				}}
			/>
		</Tabs>
	)
}
