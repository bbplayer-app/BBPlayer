import { Image } from 'expo-image'
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { skinImageSource } from '@/lib/theme/skins'

const TAB_ICON_SIZE = 58
export const SKIN_BOTTOM_TAB_BAR_HEIGHT = 92

export default function SkinBottomTabBar({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const skin = useActiveSkin()
	const insets = useSafeAreaInsets()

	if (!skin) return null

	return (
		<View
			style={[
				styles.container,
				{
					height: SKIN_BOTTOM_TAB_BAR_HEIGHT + insets.bottom,
					paddingBottom: insets.bottom,
				},
			]}
		>
			<Image
				source={skin.tabBar.background}
				style={StyleSheet.absoluteFill}
				contentFit='cover'
				cachePolicy='memory-disk'
			/>
			<View style={styles.items}>
				{state.routes.map((route, index) => {
					const focused = state.index === index
					const descriptor = descriptors[route.key]
					const options = descriptor.options
					const label =
						typeof options.tabBarLabel === 'string'
							? options.tabBarLabel
							: (options.title ?? route.name)
					const icon =
						route.name === 'index'
							? focused
								? skin.tabBar.icons.home.selected
								: skin.tabBar.icons.home.default
							: route.name === 'library/[tab]'
								? focused
									? skin.tabBar.icons.library.selected
									: skin.tabBar.icons.library.default
								: focused
									? skin.tabBar.icons.settings.selected
									: skin.tabBar.icons.settings.default

					return (
						<Pressable
							key={route.key}
							accessibilityRole='button'
							accessibilityState={focused ? { selected: true } : {}}
							accessibilityLabel={label}
							testID={options.tabBarButtonTestID}
							style={styles.item}
							onPress={() => {
								const event = navigation.emit({
									type: 'tabPress',
									target: route.key,
									canPreventDefault: true,
								})

								if (!focused && !event.defaultPrevented) {
									navigation.navigate(route.name, route.params)
								}
							}}
							onLongPress={() => {
								navigation.emit({
									type: 'tabLongPress',
									target: route.key,
								})
							}}
						>
							<Image
								source={skinImageSource(icon)}
								style={styles.icon}
								contentFit='contain'
								cachePolicy='memory-disk'
							/>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		overflow: 'hidden',
	},
	items: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	item: {
		flex: 1,
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	icon: {
		width: TAB_ICON_SIZE,
		height: TAB_ICON_SIZE,
		marginTop: -14,
	},
})
