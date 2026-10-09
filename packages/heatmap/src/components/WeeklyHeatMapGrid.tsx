import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia'
import dayjs from 'dayjs'
import { type ReactNode, useMemo } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Svg, { Text as SvgText } from 'react-native-svg'

import type { HeatMapProps } from '../types'

type Week = { weekStart: Date; days: Date[] }

interface WeeklyHeatMapGridProps {
	weeks: Week[]
	counts: Record<string, number>
	width: number
	height: number
	headerHeight: number
	cellSize: number
	cellGap: number
	cellRadius: number
	cellColor: Record<number, string>
	cellDefaultColor: string
	cellTextColor: string
	cellTextFontSize: number
	cellText: HeatMapProps['cellText']
	isCellTextVisible: boolean
	pressable: boolean
	onCellPress: HeatMapProps['onCellPress']
	children: ReactNode
}

/** One drawing node per color, rather than one React/native SVG node per day. */
export default function WeeklyHeatMapGrid({
	weeks,
	counts,
	width,
	height,
	headerHeight,
	cellSize,
	cellGap,
	cellRadius,
	cellColor,
	cellDefaultColor,
	cellTextColor,
	cellTextFontSize,
	cellText,
	isCellTextVisible,
	pressable,
	onCellPress,
	children,
}: WeeklyHeatMapGridProps) {
	const stride = cellSize + cellGap
	const paletteKey = JSON.stringify(cellColor)
	const { paths, labels } = useMemo(() => {
		const palette = JSON.parse(paletteKey) as Record<number, string>
		const levels = Object.keys(palette)
			.map(Number)
			.sort((a, b) => b - a)
		const grouped = new Map<string, SkPath>()
		const textLabels: { x: number; y: number; text: string; key: string }[] = []
		const radius = Math.max(0, Math.min(cellRadius, cellSize / 2))

		for (const [column, week] of weeks.entries()) {
			for (const [row, date] of week.days.entries()) {
				const key = dayjs(date).format('YYYY-MM-DD')
				const count = counts[key] || 0
				const level = levels.find((threshold) => count >= threshold)
				const color =
					level !== undefined && level > 0 ? palette[level] : cellDefaultColor
				let path = grouped.get(color)
				if (!path) {
					path = Skia.Path.Make()
					grouped.set(color, path)
				}
				const x = column * stride
				const y = headerHeight + row * stride
				path.addRRect({
					rect: { x, y, width: cellSize, height: cellSize },
					rx: radius,
					ry: radius,
				})
				if (isCellTextVisible) {
					const text =
						cellText === 'date'
							? dayjs(date).format('D')
							: cellText === 'count' && count > 0
								? String(count)
								: undefined
					if (text)
						textLabels.push({
							x: x + cellSize / 2,
							y: y + cellSize / 2 + cellTextFontSize / 3,
							text,
							key,
						})
				}
			}
		}
		return {
			paths: [...grouped].map(([color, path]) => ({ color, path })),
			labels: textLabels,
		}
	}, [
		weeks,
		counts,
		paletteKey,
		cellDefaultColor,
		cellRadius,
		cellSize,
		stride,
		headerHeight,
		isCellTextVisible,
		cellText,
		cellTextFontSize,
	])

	return (
		<Pressable
			testID='weekly-heatmap-grid'
			disabled={!pressable || !onCellPress}
			style={{ width, height }}
			onPress={({ nativeEvent: { locationX, locationY } }) => {
				const y = locationY - headerHeight
				if (locationX < 0 || y < 0) return
				const column = Math.floor(locationX / stride)
				const row = Math.floor(y / stride)
				// Ignore labels and gaps; dragging is handled by the parent ScrollView.
				if (locationX % stride >= cellSize || y % stride >= cellSize) return
				const date = weeks[column]?.days[row]
				if (date)
					onCellPress?.({
						date,
						count: counts[dayjs(date).format('YYYY-MM-DD')] || 0,
					})
			}}
		>
			<Canvas
				pointerEvents='none'
				style={StyleSheet.absoluteFill}
			>
				{paths.map(({ color, path }) => (
					<Path
						key={color}
						color={color}
						path={path}
					/>
				))}
			</Canvas>
			<Svg
				pointerEvents='none'
				width={width}
				height={height}
				style={StyleSheet.absoluteFill}
			>
				{children}
				{labels.map(({ x, y, text, key }) => (
					<SvgText
						key={key}
						x={x}
						y={y}
						fill={cellTextColor}
						fontSize={cellTextFontSize}
						textAnchor='middle'
					>
						{text}
					</SvgText>
				))}
			</Svg>
		</Pressable>
	)
}
