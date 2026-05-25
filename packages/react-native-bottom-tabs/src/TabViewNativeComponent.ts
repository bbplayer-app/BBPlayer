import type {
	CodegenTypes,
	ColorValue,
	ImageSource,
	ProcessedColorValue,
	ViewProps,
} from 'react-native'
import { codegenNativeComponent } from 'react-native'

type DirectEventHandler<T> = CodegenTypes.DirectEventHandler<T>
type Double = CodegenTypes.Double
type Int32 = CodegenTypes.Int32
type WithDefault<
	T extends number | boolean | string | ReadonlyArray<string>,
	U extends T | string | undefined | null,
> = CodegenTypes.WithDefault<T, U>

export type OnPageSelectedEventData = Readonly<{
	key: string
}>

export type OnTabBarMeasured = Readonly<{
	height: Int32
}>

export type OnNativeLayout = Readonly<{
	width: Double
	height: Double
}>

export type TabViewItems = ReadonlyArray<{
	key: string
	title: string
	sfSymbol?: string
	badge?: string
	badgeBackgroundColor?: ProcessedColorValue | null
	badgeTextColor?: ProcessedColorValue | null
	activeTintColor?: ProcessedColorValue | null
	hidden?: boolean
	testID?: string
	role?: string
	preventsDefault?: boolean
}>

export interface TabViewProps extends ViewProps {
	items: TabViewItems
	selectedPage: string
	onPageSelected?: DirectEventHandler<OnPageSelectedEventData>
	onTabLongPress?: DirectEventHandler<OnPageSelectedEventData>
	onTabBarMeasured?: DirectEventHandler<OnTabBarMeasured>
	onNativeLayout?: DirectEventHandler<OnNativeLayout>
	icons?: ReadonlyArray<ImageSource>
	tabBarHidden?: boolean
	labeled?: boolean
	sidebarAdaptable?: boolean
	scrollEdgeAppearance?: string
	barTintColor?: ColorValue
	translucent?: WithDefault<boolean, true>
	rippleColor?: ColorValue
	activeTintColor?: ColorValue
	inactiveTintColor?: ColorValue
	disableTintColor?: boolean
	disablePageAnimations?: boolean
	activeIndicatorColor?: ColorValue
	hapticFeedbackEnabled?: boolean
	layoutDirection?: string
	minimizeBehavior?: string
	iconSize?: Int32
	fontFamily?: string
	fontWeight?: string
	fontSize?: Int32
}

export default codegenNativeComponent<TabViewProps>('RNCTabView', {
	interfaceOnly: true,
})
