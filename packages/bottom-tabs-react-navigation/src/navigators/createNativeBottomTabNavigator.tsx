import Color from 'color'
import { appendMissingPlaceholderTabRoutes } from 'expo-router/build/standard-navigation/appendMissingPlaceholderTabRoutes'
import {
	createNavigatorFactory,
	type DefaultNavigatorOptions,
	type NavigatorTypeBagBase,
	type ParamListBase,
	type TabActionHelpers,
	type TabNavigationState,
	TabRouter,
	type TabRouterOptions,
	type TypedNavigator,
	useNavigationBuilder,
	useTheme,
} from 'expo-router/react-navigation'

import type {
	NativeBottomTabNavigationConfig,
	NativeBottomTabNavigationEventMap,
	NativeBottomTabNavigationOptions,
	NativeBottomTabNavigationProp,
} from '../types'
import NativeBottomTabView from '../views/NativeBottomTabView'

export type NativeBottomTabNavigatorProps = DefaultNavigatorOptions<
	ParamListBase,
	string | undefined,
	TabNavigationState<ParamListBase>,
	NativeBottomTabNavigationOptions,
	NativeBottomTabNavigationEventMap,
	NativeBottomTabNavigationProp<ParamListBase>
> &
	TabRouterOptions &
	NativeBottomTabNavigationConfig

function NativeBottomTabNavigator({
	id,
	initialRouteName,
	backBehavior,
	children,
	layout,
	screenListeners,
	screenOptions,
	screenLayout,
	UNSTABLE_router,
	tabBarActiveTintColor: customActiveTintColor,
	tabBarInactiveTintColor: customInactiveTintColor,
	layoutDirection = 'locale',
	...rest
}: NativeBottomTabNavigatorProps) {
	const { colors } = useTheme()
	const activeTintColor =
		customActiveTintColor === undefined ? colors.primary : customActiveTintColor

	const inactiveTintColor =
		customInactiveTintColor === undefined
			? Color(colors.text).mix(Color(colors.card), 0.5).hex()
			: customInactiveTintColor

	const { state, descriptors, describe, navigation, NavigationContent } =
		useNavigationBuilder<
			TabNavigationState<ParamListBase>,
			TabRouterOptions,
			TabActionHelpers<ParamListBase>,
			NativeBottomTabNavigationOptions,
			NativeBottomTabNavigationEventMap
		>(TabRouter, {
			id,
			initialRouteName,
			backBehavior,
			children,
			layout,
			screenListeners,
			screenOptions,
			screenLayout,
			UNSTABLE_router,
		})

	// Expo Router 58 only stores visited tabs in state.routes. Include its
	// placeholder descriptors and routes so every declared tab has a button.
	const tabDescriptors = { ...descriptors }
	for (const name of state.routeNames) {
		if (!state.routes.some((route) => route.name === name)) {
			tabDescriptors[name] = describe({ key: undefined, name })
		}
	}
	const tabState = appendMissingPlaceholderTabRoutes(state, tabDescriptors)

	return (
		<NavigationContent>
			<NativeBottomTabView
				{...rest}
				layoutDirection={layoutDirection}
				tabBarActiveTintColor={activeTintColor}
				tabBarInactiveTintColor={inactiveTintColor}
				state={tabState}
				navigation={navigation}
				descriptors={tabDescriptors}
			/>
		</NavigationContent>
	)
}

export default function createNativeBottomTabNavigator<
	const ParamList extends ParamListBase,
	const NavigatorID extends string | undefined = undefined,
	const TypeBag extends NavigatorTypeBagBase = {
		ParamList: ParamList
		NavigatorID: NavigatorID
		State: TabNavigationState<ParamList>
		ScreenOptions: NativeBottomTabNavigationOptions
		EventMap: NativeBottomTabNavigationEventMap
		NavigationList: {
			[RouteName in keyof ParamList]: NativeBottomTabNavigationProp<
				ParamList,
				RouteName,
				NavigatorID
			>
		}
		Navigator: typeof NativeBottomTabNavigator
	},
>(): TypedNavigator<TypeBag> {
	return createNavigatorFactory(NativeBottomTabNavigator)()
}
