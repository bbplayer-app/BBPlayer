import { createContext, useContext } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const NAVIGATION_RAIL_WIDTH = 96
/** 单列列表页在宽屏下的最大内容宽度。 */
export const CONTENT_MAX_WIDTH = 960
export const NativeTabRailWidthContext = createContext(0)

export const ResponsiveLayoutContext = createContext<{
	width: number
	height: number
} | null>(null)

/** Use the available content width, including when the app is in a split window. */
export function useResponsiveLayout() {
	const window = useWindowDimensions()
	const insets = useSafeAreaInsets()
	const container = useContext(ResponsiveLayoutContext)
	const width = container?.width ?? window.width - insets.left - insets.right
	const height =
		(container?.height ?? window.height) - insets.top - insets.bottom
	return {
		width,
		height,
		fontScale: window.fontScale,
		isTablet: width >= 600,
		isExpanded: width >= 840,
		isTwoPane: width >= 840 && height >= 600,
		gutter: width >= 600 ? 24 : 0,
	}
}
