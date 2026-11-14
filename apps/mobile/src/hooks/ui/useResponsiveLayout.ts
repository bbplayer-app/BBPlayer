import { createContext, useContext } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * 全项目的断点与布局尺寸都定义在这里，页面里不要再自己比较宽高。
 *
 * 断点参照 Material 3 的窗口尺寸分级（单位 dp）：
 * - Compact：宽 < 600
 * - Medium：600 ≤ 宽 < 840
 * - Expanded：宽 ≥ 840
 */
export const BREAKPOINTS = {
	/** 进入 Medium：启用侧边导航栏、网格列表。 */
	medium: 600,
	/** 进入 Expanded：设置页等主从分栏。 */
	expanded: 840,
	/** 双栏布局要求的最小高度，排除横屏手机这类扁长窗口。 */
	twoPaneMinHeight: 600,
	/** 小于此宽度视为紧凑尺寸（小屏手机）。 */
	compactWidth: 360,
	/** 可用高度小于此值视为紧凑尺寸（矮屏或横屏手机）。 */
	compactHeight: 600,
} as const

/** 各类内容在宽屏下的最大宽度。 */
export const MAX_WIDTH = {
	/** 单列列表页。 */
	content: 960,
	/** 搜索首页的搜索框与内容。 */
	search: 720,
	/** 弹窗，参照 Material 3 对话框的上限。 */
	dialog: 560,
	/** 播放器的封面与控制区。 */
	player: 600,
} as const

export const NAVIGATION_RAIL_WIDTH = 96

export const NativeTabRailWidthContext = createContext(0)

/** 尺寸是否紧凑。既用于页面级判断，也可传入组件自己测量到的尺寸。 */
export function isCompactSize({
	width,
	height,
}: {
	width: number
	height: number
}) {
	return width < BREAKPOINTS.compactWidth || height < BREAKPOINTS.compactHeight
}

/** 弹窗的水平外边距：窄屏保持 minMargin，宽屏时收窄到 MAX_WIDTH.dialog 并居中。 */
export function useDialogHorizontalMargin(minMargin = 26) {
	// 弹窗覆盖整个窗口，按窗口宽度计算。
	const { width } = useWindowDimensions()

	return Math.max(minMargin, (width - MAX_WIDTH.dialog) / 2)
}

/**
 * 当前页面内容区的尺寸，由 ResponsiveContent 测量后提供。
 * 已经扣除了左右安全区和侧边导航栏，但没有扣除上下安全区。
 */
export const ResponsiveLayoutContext = createContext<{
	width: number
	height: number
} | null>(null)

/**
 * 当前内容区的尺寸与断点。
 *
 * 在页面内调用时使用 ResponsiveContent 测量到的内容区尺寸（分屏、小窗也正确）；
 * 在页面之外调用（如根布局决定是否显示导航栏）时回退到窗口尺寸。
 */
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
		isCompact: isCompactSize({ width, height }),
		isTablet: width >= BREAKPOINTS.medium,
		isExpanded: width >= BREAKPOINTS.expanded,
		isTwoPane:
			width >= BREAKPOINTS.expanded && height >= BREAKPOINTS.twoPaneMinHeight,
	}
}
