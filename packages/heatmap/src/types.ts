import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HeatMapDailyProps = {
	data: (Date | string)[] | Record<string, number>
}

export type HeatMapWeeklyProps = {
	weekStartsOn?: Day
	cellText?: 'date' | 'count'
}

export type HeatMapScheme = 'light' | 'dark'

export type HeatMapColor = {
	headerTextColor?: string
	cellDefaultColor?: string
	cellTextColor?: string
	cellColor?: Record<number, string>
	sidebarTextColor?: string
}

export type HeatMapThemeProps = HeatMapColor & {
	scheme?: HeatMapScheme
} & {
	[key in HeatMapScheme]?: HeatMapColor
}

export type HeatMapDimensionsProps = {
	headerTextFontSize?: number
	headerBottomSpace?: number
	cellSize?: number
	cellRadius?: number
	cellGap?: number
	cellTextFontSize?: number
	sideBarTextFontSize?: number
}

export type HeatMapStyle = {
	scrollStyle?: StyleProp<ViewStyle>
	headerTextAlign?: TextStyle['textAlign']
}

export type HeatMapControllerProps = {
	pressable?: boolean
	hoverable?: boolean
	scrollable?: boolean
	rtl?: boolean
	initialScrollEnd?: boolean
	isHeaderVisible?: boolean
	isCellTextVisible?: boolean
	isSidebarVisible?: boolean
}

export type HeatMapFormatterProps = {
	headerTextFormat?: string
	sidebarTextFormat?: string
	/** Locale name or object */
	locale?: string | { name: string }
}

export type HeatMapDatetimeProps = {
	startDate?: Date
	endDate?: Date
	hiddenDays?: Day[]
}

export type HeatMapActionsProps = {
	onCellPress?: (params: { date: Date; count: number }) => void
	onMouseEnter?: (params: {
		date: Date
		x: number
		y: number
		count: number
	}) => void
	onMouseLeave?: () => void
}

export type HeatMapProps = HeatMapDailyProps &
	HeatMapWeeklyProps &
	HeatMapThemeProps &
	HeatMapDimensionsProps &
	HeatMapControllerProps &
	HeatMapFormatterProps &
	HeatMapDatetimeProps &
	HeatMapActionsProps &
	HeatMapStyle
