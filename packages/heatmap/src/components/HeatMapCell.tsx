import React, { memo } from 'react'
import { Rect, Text as SvgText } from 'react-native-svg'

interface HeatMapCellProps {
	x: number
	y: number
	size: number
	radius: number
	color: string
	count: number
	date: Date
	pressable?: boolean
	onPress?: (params: { date: Date; count: number }) => void
	onMouseEnter?: (params: {
		date: Date
		x: number
		y: number
		count: number
	}) => void
	onMouseLeave?: () => void
	cellText?: string
	cellTextColor?: string
	cellTextFontSize?: number
}

const HeatMapCell = ({
	x,
	y,
	size,
	radius,
	color,
	count,
	date,
	pressable,
	onPress,
	cellText,
	cellTextColor,
	cellTextFontSize = 10,
}: HeatMapCellProps) => {
	const handlePress = () => {
		if (pressable && onPress) {
			onPress({ date, count })
		}
	}

	return (
		<React.Fragment>
			<Rect
				x={x}
				y={y}
				width={size}
				height={size}
				rx={radius}
				ry={radius}
				fill={color}
				onPress={handlePress}
			/>
			{cellText && (
				<SvgText
					x={x + size / 2}
					y={y + size / 2 + cellTextFontSize / 3}
					fill={cellTextColor}
					fontSize={cellTextFontSize}
					textAnchor='middle'
					pointerEvents='none'
				>
					{cellText}
				</SvgText>
			)}
		</React.Fragment>
	)
}

export default memo(HeatMapCell)
