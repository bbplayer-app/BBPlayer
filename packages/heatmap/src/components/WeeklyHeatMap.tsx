import dayjs from 'dayjs'
import { JSX, useCallback, useMemo, useRef } from 'react'
import { ScrollView, View } from 'react-native'
import Svg, { G, Text as SvgText } from 'react-native-svg'

import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../constants/theme'
import { HeatMapProps } from '../types'
import { countData, getWeeklyData } from '../utils/calendar'

import WeeklyHeatMapGrid from './WeeklyHeatMapGrid'

export const WeeklyHeatMap = ({
	data,
	startDate,
	endDate,
	weekStartsOn = 0,
	cellSize = 20,
	cellRadius = 2,
	cellGap = 2,
	cellText,
	cellTextFontSize = 10,
	headerTextFontSize = 12,
	headerBottomSpace = 8,
	sideBarTextFontSize = 12,
	scheme = 'light',
	isHeaderVisible = true,
	isSidebarVisible = true,
	isCellTextVisible = false,
	pressable = true,
	onCellPress,
	scrollable = true,
	rtl = false,
	initialScrollEnd = false,
	locale,
	headerTextFormat = 'MMM',
	sidebarTextFormat = 'ddd',
	...props
}: HeatMapProps) => {
	const scrollViewRef = useRef<ScrollView>(null)
	const scrolledRef = useRef(false)

	const onLayout = useCallback(() => {
		if (!scrolledRef.current && (rtl || initialScrollEnd)) {
			scrolledRef.current = true
			scrollViewRef.current?.scrollToEnd({ animated: false })
		}
	}, [rtl, initialScrollEnd])

	const startDay = dayjs(startDate || dayjs().subtract(1, 'year'))
		.startOf('day')
		.valueOf()
	const endDay = dayjs(endDate).startOf('day').valueOf()

	const baseTheme =
		scheme === 'light' ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME
	const customTheme = props[scheme] || {}
	const theme = { ...baseTheme, ...props, ...customTheme }

	const counts = useMemo(() => countData(data), [data])

	const localeName = typeof locale === 'string' ? locale : locale?.name || 'en'

	const weeks = useMemo(
		() => getWeeklyData(new Date(startDay), new Date(endDay), weekStartsOn),
		[startDay, endDay, weekStartsOn],
	)

	const displayedWeeks = useMemo(
		() => (rtl ? [...weeks].toReversed() : weeks),
		[rtl, weeks],
	)

	const sidebarWidth = isSidebarVisible ? sideBarTextFontSize * 3 : 0
	const headerHeight = isHeaderVisible
		? headerTextFontSize + headerBottomSpace
		: 0

	const width = sidebarWidth + (cellSize + cellGap) * weeks.length
	const height = headerHeight + (cellSize + cellGap) * 7

	const renderHeader = () => {
		if (!isHeaderVisible) return null

		const monthLabels: JSX.Element[] = []
		let lastMonth = -1

		displayedWeeks.forEach((week, index) => {
			const month = dayjs(week.weekStart).month()
			if (month !== lastMonth) {
				// A month starting in the final column can be wider than one cell.
				// Align its trailing edge with the last cell so the SVG won't clip it.
				const isLastColumn = index === displayedWeeks.length - 1
				const x =
					sidebarWidth +
					index * (cellSize + cellGap) +
					(isLastColumn ? cellSize : 0)
				monthLabels.push(
					<SvgText
						// oxlint-disable-next-line react/no-array-index-key
						key={`month-${index}`}
						x={x}
						y={headerTextFontSize}
						fill={theme.headerTextColor}
						fontSize={headerTextFontSize}
						textAnchor={isLastColumn ? 'end' : 'start'}
					>
						{dayjs(week.weekStart).locale(localeName).format(headerTextFormat)}
					</SvgText>,
				)
				lastMonth = month
			}
		})

		return monthLabels
	}

	const renderSidebar = () => {
		if (!isSidebarVisible) return null

		const dayLabels: JSX.Element[] = []
		for (let i = 0; i < 7; i++) {
			const day = dayjs().day((i + weekStartsOn) % 7)
			dayLabels.push(
				<SvgText
					key={`day-${i}`}
					x={sidebarWidth - 8}
					y={
						headerHeight +
						i * (cellSize + cellGap) +
						cellSize / 2 +
						sideBarTextFontSize / 3
					}
					fill={theme.sidebarTextColor}
					fontSize={sideBarTextFontSize}
					textAnchor='end'
				>
					{day.locale(localeName).format(sidebarTextFormat)}
				</SvgText>,
			)
		}
		return dayLabels
	}

	const gridContent = (
		<WeeklyHeatMapGrid
			weeks={displayedWeeks}
			counts={counts}
			width={width - sidebarWidth}
			height={height}
			headerHeight={headerHeight}
			cellSize={cellSize}
			cellGap={cellGap}
			cellRadius={cellRadius}
			cellColor={theme.cellColor}
			cellDefaultColor={theme.cellDefaultColor}
			cellTextColor={theme.cellTextColor}
			cellTextFontSize={cellTextFontSize}
			cellText={cellText}
			isCellTextVisible={isCellTextVisible}
			pressable={pressable}
			onCellPress={onCellPress}
		>
			<G x={-sidebarWidth}>{renderHeader()}</G>
		</WeeklyHeatMapGrid>
	)

	if (scrollable) {
		return (
			<View style={[{ flexDirection: 'row' as const }, props.scrollStyle]}>
				{isSidebarVisible && (
					<Svg
						width={sidebarWidth}
						height={height}
					>
						{renderSidebar()}
					</Svg>
				)}
				<ScrollView
					horizontal
					ref={scrollViewRef}
					onLayout={onLayout}
					showsHorizontalScrollIndicator={false}
					contentOffset={
						rtl ? { x: width - sidebarWidth, y: 0 } : { x: 0, y: 0 }
					}
				>
					{gridContent}
				</ScrollView>
			</View>
		)
	}

	return (
		<View style={[{ flexDirection: 'row' as const }, props.scrollStyle]}>
			{isSidebarVisible && (
				<Svg
					width={sidebarWidth}
					height={height}
				>
					{renderSidebar()}
				</Svg>
			)}
			<View>{gridContent}</View>
		</View>
	)
}
