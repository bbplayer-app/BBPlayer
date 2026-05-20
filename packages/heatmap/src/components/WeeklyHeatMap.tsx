import dayjs from 'dayjs'
import { JSX, useCallback, useRef } from 'react'
import { ScrollView, View } from 'react-native'
import Svg, { G, Text as SvgText } from 'react-native-svg'

import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../constants/theme'
import { HeatMapProps } from '../types'
import { countData, getWeeklyData, getColor } from '../utils/calendar'

import HeatMapCell from './HeatMapCell'

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
	onMouseEnter,
	onMouseLeave,
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

	const resolvedStartDate = startDate || dayjs().subtract(1, 'year').toDate()
	const resolvedEndDate = endDate || new Date()

	const baseTheme =
		scheme === 'light' ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME
	const customTheme = props[scheme] || {}
	const theme = { ...baseTheme, ...props, ...customTheme }

	const counts = countData(data)

	const localeName = typeof locale === 'string' ? locale : locale?.name || 'en'

	const weeks = getWeeklyData(resolvedStartDate, resolvedEndDate, weekStartsOn)

	const displayedWeeks = rtl ? [...weeks].toReversed() : weeks

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
				const x = sidebarWidth + index * (cellSize + cellGap)
				monthLabels.push(
					<SvgText
						// oxlint-disable-next-line react/no-array-index-key
						key={`month-${index}`}
						x={x}
						y={headerTextFontSize}
						fill={theme.headerTextColor}
						fontSize={headerTextFontSize}
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
		<G x={-sidebarWidth}>
			{renderHeader()}
			<G
				x={sidebarWidth}
				y={headerHeight}
			>
				{displayedWeeks.map((week, weekIndex) => (
					<G
						// oxlint-disable-next-line react/no-array-index-key
						key={`week-${weekIndex}`}
						x={weekIndex * (cellSize + cellGap)}
					>
						{week.days.map((day, dayIndex) => {
							const dateStr = dayjs(day).format('YYYY-MM-DD')
							const count = counts[dateStr] || 0
							const color = getColor(
								count,
								theme.cellColor,
								theme.cellDefaultColor,
							)

							let text: string | undefined
							if (isCellTextVisible) {
								if (cellText === 'date') text = dayjs(day).format('D')
								else if (cellText === 'count')
									text = count > 0 ? count.toString() : undefined
							}

							return (
								<HeatMapCell
									// oxlint-disable-next-line react/no-array-index-key
									key={`day-${dayIndex}`}
									x={0}
									y={dayIndex * (cellSize + cellGap)}
									size={cellSize}
									radius={cellRadius}
									color={color}
									count={count}
									date={day}
									pressable={pressable}
									onPress={onCellPress}
									onMouseEnter={onMouseEnter}
									onMouseLeave={onMouseLeave}
									cellText={text}
									cellTextColor={theme.cellTextColor}
									cellTextFontSize={cellTextFontSize}
								/>
							)
						})}
					</G>
				))}
			</G>
		</G>
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
					<Svg
						width={width - sidebarWidth}
						height={height}
					>
						{gridContent}
					</Svg>
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
			<View>
				<Svg
					width={width - sidebarWidth}
					height={height}
				>
					{gridContent}
				</Svg>
			</View>
		</View>
	)
}
