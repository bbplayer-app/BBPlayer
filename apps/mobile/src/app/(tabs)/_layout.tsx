import MaterialIcon from '@react-native-vector-icons/material-design-icons'
import { Image } from 'expo-image'
import { usePathname, useRouter } from 'expo-router'
import { NativeTabs } from 'expo-router/native-tabs'
import type { NativeTabTriggerProps } from 'expo-router/native-tabs'
import type { ImageSourcePropType } from 'react-native'
import { Platform, StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, Text } from 'react-native-paper'
import { useTheme } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import {
	NAVIGATION_RAIL_WIDTH,
	NativeTabRailWidthContext,
	useResponsiveLayout,
} from '@/hooks/ui/useResponsiveLayout'

const searchIcon = MaterialIcon.getImageSourceSync('magnify', 24)
const libraryIcon = MaterialIcon.getImageSourceSync('bookshelf', 24)
const profileIcon = MaterialIcon.getImageSourceSync('account', 24)

type SkinIcon = { default: string | null; selected: string | null }

function originalAndroidIcons(
	icon: SkinIcon | undefined,
	colors: MD3Theme['colors'],
): NativeTabTriggerProps['unstable_nativeProps'] {
	if (!icon?.default || !icon.selected) return undefined
	return {
		android: {
			// Theme artwork needs a larger canvas than Material's default 24dp icons.
			standardAppearance: {
				tabBarItemIconSize: 50,
				// Fit the artwork into the standard 80dp bar by reducing vertical padding.
				tabBarItemPaddingTop: 3,
				tabBarItemPaddingBottom: 7,
				tabBarBackgroundColor: colors.elevation.level1,
				tabBarItemRippleColor: colors.primary,
				// Keep the indicator's ripple mask while hiding its selected background.
				tabBarItemActiveIndicatorEnabled: true,
				tabBarItemActiveIndicatorColor: 'transparent',
				// Match RNBT's Material indicator instead of scaling it with the artwork.
				tabBarItemActiveIndicatorWidth: 64,
				tabBarItemActiveIndicatorHeight: 32,
				normal: {
					tabBarItemTitleFontColor: colors.onSurfaceVariant,
					tabBarItemIconColor: colors.onSurfaceVariant,
				},
				selected: {
					tabBarItemTitleFontColor: colors.primary,
					tabBarItemIconColor: colors.primary,
				},
			},
			icon: {
				type: 'imageSource',
				imageSource: { uri: icon.default },
				tinting: 'original',
			},
			selectedIcon: {
				type: 'imageSource',
				imageSource: { uri: icon.selected },
				tinting: 'original',
			},
		},
	}
}

function iconSource(icon: SkinIcon | undefined, fallback: ImageSourcePropType) {
	return {
		default: icon?.default ? { uri: icon.default } : fallback,
		selected: icon?.selected ? { uri: icon.selected } : fallback,
	}
}

function nativeIconProps(
	icon: SkinIcon | undefined,
	fallback: ImageSourcePropType,
	colors: MD3Theme['colors'],
): NativeTabTriggerProps['unstable_nativeProps'] {
	const source = iconSource(icon, fallback)
	return {
		...originalAndroidIcons(icon, colors),
		ios: {
			icon: {
				type: 'imageSource',
				imageSource: source.default,
				renderingMode: icon?.default ? 'original' : 'template',
			},
			selectedIcon: {
				type: 'imageSource',
				imageSource: source.selected,
				renderingMode: icon?.selected ? 'original' : 'template',
			},
		},
	}
}

export default function TabLayout() {
	const { colors } = useTheme()
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const { isExpanded } = useResponsiveLayout()
	const insets = useSafeAreaInsets()
	const pathname = usePathname()
	const router = useRouter()
	const showRail = Platform.OS === 'android' && isExpanded

	const icons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons
	const useSkinTabs = Boolean(
		icons?.home.default &&
		icons.home.selected &&
		icons.library.default &&
		icons.library.selected &&
		icons.settings.default &&
		icons.settings.selected,
	)

	return (
		<View style={styles.layout}>
			{showRail && (
				<View
					style={[
						styles.rail,
						{
							backgroundColor: colors.elevation.level1,
							paddingTop: insets.top + 24,
						},
					]}
				>
					{[
						{
							label: '搜索',
							path: '/' as const,
							icon: 'magnify',
							skin: icons?.home,
							id: 'search',
							selected: pathname === '/',
						},
						{
							label: '音乐库',
							path: '/library/0' as const,
							icon: 'bookshelf',
							skin: icons?.library,
							id: 'library',
							selected: pathname.startsWith('/library'),
						},
						{
							label: '我的',
							path: '/my' as const,
							icon: 'account',
							skin: icons?.settings,
							id: 'my',
							selected: pathname === '/my',
						},
					].map((tab) => (
						<Touchable
							key={tab.id}
							onPress={() => router.navigate(tab.path)}
							accessibilityRole='tab'
							accessibilityState={{ selected: tab.selected }}
							accessibilityLabel={tab.label}
							testID={`tablet-tab-${tab.id}`}
							style={styles.railTab}
						>
							<View
								collapsable={false}
								style={[
									styles.railIcon,
									{
										backgroundColor: tab.selected
											? colors.secondaryContainer
											: 'transparent',
									},
								]}
							>
								{tab.skin?.default ? (
									<Image
										source={{
											uri: tab.selected
												? (tab.skin.selected ?? tab.skin.default)
												: tab.skin.default,
										}}
										style={{ width: 48, height: 48 }}
										contentFit='contain'
									/>
								) : (
									<Icon
										source={tab.icon}
										size={24}
										color={
											tab.selected
												? colors.onSecondaryContainer
												: colors.onSurfaceVariant
										}
									/>
								)}
							</View>
							<Text
								variant='labelMedium'
								style={{
									color: tab.selected
										? colors.onSurface
										: colors.onSurfaceVariant,
								}}
							>
								{tab.label}
							</Text>
						</Touchable>
					))}
				</View>
			)}
			<View style={styles.content}>
				<NativeTabRailWidthContext value={showRail ? NAVIGATION_RAIL_WIDTH : 0}>
					<NativeTabs
						hidden={showRail}
						tintColor={colors.primary}
						backgroundColor={colors.elevation.level1}
						iconColor={{
							default: colors.onSurfaceVariant,
							selected: colors.primary,
						}}
						labelStyle={{
							default: { color: colors.onSurfaceVariant },
							selected: { color: colors.primary },
						}}
						indicatorColor={
							useSkinTabs ? 'transparent' : colors.secondaryContainer
						}
						minimizeBehavior='never'
						backBehavior='initialRoute'
					>
						<NativeTabs.Trigger
							name='index'
							testID='tab-search'
							disableAutomaticContentInsets
							unstable_nativeProps={nativeIconProps(
								icons?.home,
								searchIcon,
								colors,
							)}
						>
							<NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
							<NativeTabs.Trigger.Icon
								src={iconSource(icons?.home, searchIcon)}
								renderingMode={icons?.home.default ? 'original' : 'template'}
							/>
						</NativeTabs.Trigger>
						<NativeTabs.Trigger
							name='library/[tab]'
							testID='tab-library'
							disableAutomaticContentInsets
							unstable_nativeProps={nativeIconProps(
								icons?.library,
								libraryIcon,
								colors,
							)}
						>
							<NativeTabs.Trigger.Label>音乐库</NativeTabs.Trigger.Label>
							<NativeTabs.Trigger.Icon
								src={iconSource(icons?.library, libraryIcon)}
								renderingMode={icons?.library.default ? 'original' : 'template'}
							/>
						</NativeTabs.Trigger>
						<NativeTabs.Trigger
							name='my'
							testID='tab-my'
							disableAutomaticContentInsets
							unstable_nativeProps={nativeIconProps(
								icons?.settings,
								profileIcon,
								colors,
							)}
						>
							<NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
							<NativeTabs.Trigger.Icon
								src={iconSource(icons?.settings, profileIcon)}
								renderingMode={
									icons?.settings.default ? 'original' : 'template'
								}
							/>
						</NativeTabs.Trigger>
					</NativeTabs>
				</NativeTabRailWidthContext>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	layout: { flex: 1, flexDirection: 'row' },
	content: { flex: 1, minWidth: 0 },
	rail: { width: NAVIGATION_RAIL_WIDTH, gap: 12, paddingHorizontal: 8 },
	railTab: { alignItems: 'center', gap: 4, paddingVertical: 8 },
	railIcon: {
		width: 64,
		height: 48,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		overflow: 'hidden',
		justifyContent: 'center',
		alignItems: 'center',
	},
})
