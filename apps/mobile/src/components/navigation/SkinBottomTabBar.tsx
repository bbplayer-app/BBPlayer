import type { BottomTabBarProps } from '@bottom-tabs/react-navigation'
import { Image } from 'expo-image'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { skinImageSource } from '@/lib/theme/skins'

const TAB_ICON_SIZE = 50
const TAB_BAR_HEIGHT = 72

export default function SkinBottomTabBar({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const skin = useActiveSkin()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()

	if (!skin) return null

	return (
		<View
			style={[
				styles.container,
				{
					height: TAB_BAR_HEIGHT + insets.bottom,
					paddingBottom: insets.bottom,
					backgroundColor: colors.elevation.level1,
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
							<Text
								variant='labelSmall'
								numberOfLines={1}
								style={[
									styles.label,
									{
										color: focused
											? skin.tabBar.labelSelectedColor
											: skin.tabBar.labelColor,
									},
								]}
							>
								{label}
							</Text>
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
		gap: 0,
	},
	icon: {
		width: TAB_ICON_SIZE,
		height: TAB_ICON_SIZE,
	},
	label: {
		includeFontPadding: false,
		marginTop: -6,
	},
})
