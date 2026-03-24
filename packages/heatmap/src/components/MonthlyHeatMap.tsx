import dayjs from 'dayjs'
import React, { useCallback, useRef } from 'react'
import { ScrollView, View } from 'react-native'
import Svg, { G, Text as SvgText } from 'react-native-svg'

import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../constants/theme'
import { HeatMapProps } from '../types'
import { countData, getMonthlyData, getColor } from '../utils/calendar'

import HeatMapCell from './HeatMapCell'

export const MonthlyHeatMap = ({
	data,
	startDate,
	endDate,
	weekStartsOn = 0,
	cellSize = 20,
	cellRadius = 2,
	cellGap = 2,
	cellText,
	cellTextFontSize = 10,
	headerTextFontSize = 14,
	headerBottomSpace = 8,
	sideBarTextFontSize = 12,
	scheme = 'light',
	isHeaderVisible = true,
	isSidebarVisible = false,
	isCellTextVisible = true,
	pressable = true,
	onCellPress,
	onMouseEnter,
	onMouseLeave,
	scrollable = true,
	rtl = false,
	initialScrollEnd = false,
	locale,
	headerTextFormat = 'MMMM YYYY',
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

	const resolvedStartDate = startDate || dayjs().startOf('year').toDate()
	const resolvedEndDate = endDate || dayjs().endOf('year').toDate()

	const baseTheme =
		scheme === 'light' ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME
	const customTheme = props[scheme] || {}
	const theme = { ...baseTheme, ...props, ...customTheme }

	const counts = countData(data)

	const localeName = typeof locale === 'string' ? locale : locale?.name || 'en'

	const months = getMonthlyData(resolvedStartDate, resolvedEndDate)

	const displayedMonths = rtl ? [...months].toReversed() : months

	const monthWidth = (cellSize + cellGap) * 7
	const monthHeight =
		(isHeaderVisible ? headerTextFontSize + headerBottomSpace : 0) +
		(cellSize + cellGap) * 6

	const sidebarWidth = isSidebarVisible ? sideBarTextFontSize * 3 : 0

	const renderMonth = (
		monthData: { month: Date; days: Date[] },
		index: number,
	) => {
		const startOffset = (dayjs(monthData.month).day() - weekStartsOn + 7) % 7
		const xBase = sidebarWidth + index * (monthWidth + cellSize) // monthWidth + spacing between months

		return (
			<G
				key={`month-${index}`}
				x={xBase}
			>
				{isHeaderVisible && (
					<SvgText
						x={0}
						y={headerTextFontSize}
						fill={theme.headerTextColor}
						fontSize={headerTextFontSize}
						fontWeight='bold'
					>
						{dayjs(monthData.month).locale(localeName).format(headerTextFormat)}
					</SvgText>
				)}
				<G y={isHeaderVisible ? headerTextFontSize + headerBottomSpace : 0}>
					{monthData.days.map((day, dayIndex) => {
						const dateStr = dayjs(day).format('YYYY-MM-DD')
						const count = counts[dateStr] || 0
						const color = getColor(
							count,
							theme.cellColor,
							theme.cellDefaultColor,
						)

						const gridIndex = dayIndex + startOffset
						const col = gridIndex % 7
						const row = Math.floor(gridIndex / 7)

						let text: string | undefined
						if (isCellTextVisible) {
							if (cellText === 'date') text = dayjs(day).format('D')
							else if (cellText === 'count')
								text = count > 0 ? count.toString() : undefined
							else text = dayjs(day).format('D') // default to date for monthly view
						}

						return (
							<HeatMapCell
								// oxlint-disable-next-line react/no-array-index-key
								key={`day-${dayIndex}`}
								x={col * (cellSize + cellGap)}
								y={row * (cellSize + cellGap)}
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
			</G>
		)
	}

	const totalWidth =
		sidebarWidth + displayedMonths.length * (monthWidth + cellSize)

	const content = (
		<Svg
			width={totalWidth}
			height={monthHeight}
		>
			{isSidebarVisible && (
				<G y={isHeaderVisible ? headerTextFontSize + headerBottomSpace : 0}>
					{[0, 1, 2, 3, 4, 5, 6].map((i) => {
						const day = dayjs().day((i + weekStartsOn) % 7)
						return (
							<SvgText
								key={`sidebar-${i}`}
								x={sidebarWidth - 8}
								y={
									i * (cellSize + cellGap) +
									cellSize / 2 +
									sideBarTextFontSize / 3
								}
								fill={theme.sidebarTextColor}
								fontSize={sideBarTextFontSize}
								textAnchor='end'
							>
								{day.locale(localeName).format(sidebarTextFormat)}
							</SvgText>
						)
					})}
				</G>
			)}
			{displayedMonths.map((month, index) => renderMonth(month, index))}
		</Svg>
	)

	if (scrollable) {
		return (
			<ScrollView
				horizontal
				ref={scrollViewRef}
				onLayout={onLayout}
				showsHorizontalScrollIndicator={false}
				contentOffset={rtl ? { x: totalWidth, y: 0 } : { x: 0, y: 0 }}
				style={props.scrollStyle}
			>
				{content}
			</ScrollView>
		)
	}

	return <View style={props.scrollStyle}>{content}</View>
}
