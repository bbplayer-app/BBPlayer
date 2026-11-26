import {
	Canvas,
	LinearGradient,
	Path,
	Skia,
	vec,
} from '@shopify/react-native-skia'
import type { SkPathBuilder } from '@shopify/react-native-skia'
import Color from 'color'
import { memo, useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import {
	useDerivedValue,
	useSharedValue,
	type SharedValue,
} from 'react-native-reanimated'
import Svg, { Line, Text as SvgText } from 'react-native-svg'

import {
	EQ_CURVE_TABLE,
	evaluateEqResponseWorklet,
} from '@/features/equalizer/utils/eqCurveMath'

const CURVE_HEIGHT = 176

const CURVE_RANGE_DB = 18

const CHART_PADDING_LEFT = 26

const CHART_PADDING_RIGHT = 6

const CHART_PADDING_TOP = 10

const CHART_PADDING_BOTTOM = 20

const GRID_LEVELS_DB = [12, 6, 0, -6, -12] as const

const AXIS_LABELS_DB = [12, 0, -12] as const

const FREQUENCY_MARKS = [
	{ hz: 100, label: '100' },
	{ hz: 1000, label: '1k' },
	{ hz: 10000, label: '10k' },
] as const

const MIN_FREQUENCY_HZ = 20

const MAX_FREQUENCY_HZ = 20000

const FREQUENCY_RANGE = Math.log(MAX_FREQUENCY_HZ / MIN_FREQUENCY_HZ)

function frequencyToRatio(frequency: number): number {
	const ratio = Math.log(frequency / MIN_FREQUENCY_HZ) / FREQUENCY_RANGE

	return Math.min(Math.max(ratio, 0), 1)
}

function clampCurveDb(value: number): number {
	'worklet'

	if (!Number.isFinite(value)) return 0

	return Math.min(Math.max(value, -CURVE_RANGE_DB), CURVE_RANGE_DB)
}

function appendCurveToBuilder(
	builder: SkPathBuilder,
	response: readonly number[],
	pointXs: readonly number[],
	centerY: number,
	scale: number,
): void {
	'worklet'

	const pointCount = pointXs.length

	if (pointCount === 0) return

	builder.moveTo(pointXs[0], centerY - clampCurveDb(response[0]) * scale)

	for (let index = 1; index < pointCount - 1; index += 1) {
		const x = pointXs[index]

		const y = centerY - clampCurveDb(response[index]) * scale

		const nextX = pointXs[index + 1]

		const nextY = centerY - clampCurveDb(response[index + 1]) * scale

		builder.quadTo(x, y, (x + nextX) / 2, (y + nextY) / 2)
	}

	if (pointCount > 1) {
		const lastIndex = pointCount - 1

		builder.lineTo(
			pointXs[lastIndex],
			centerY - clampCurveDb(response[lastIndex]) * scale,
		)
	}
}

interface StaticChartProps {
	width: number
	chartWidth: number
	gridColor: string
	zeroLineColor: string
	labelColor: string
}

const StaticChart = memo(function StaticChart({
	width,
	chartWidth,
	gridColor,
	zeroLineColor,
	labelColor,
}: StaticChartProps) {
	const chartHeight = CURVE_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

	const centerY = CHART_PADDING_TOP + chartHeight / 2

	const scale = chartHeight / 2 / CURVE_RANGE_DB

	const yForLevel = (levelDb: number) => centerY - levelDb * scale

	return (
		<Svg
			width={width}
			height={CURVE_HEIGHT}
		>
			{GRID_LEVELS_DB.map((levelDb) => (
				<Line
					key={`grid-${levelDb}`}
					x1={CHART_PADDING_LEFT}
					x2={CHART_PADDING_LEFT + chartWidth}
					y1={yForLevel(levelDb)}
					y2={yForLevel(levelDb)}
					stroke={levelDb === 0 ? zeroLineColor : gridColor}
					strokeWidth={1}
					strokeDasharray={levelDb === 0 ? undefined : '4 6'}
					opacity={levelDb === 0 ? 0.9 : 0.6}
				/>
			))}
			{FREQUENCY_MARKS.map((mark) => (
				<Line
					key={`mark-${mark.hz}`}
					x1={CHART_PADDING_LEFT + frequencyToRatio(mark.hz) * chartWidth}
					x2={CHART_PADDING_LEFT + frequencyToRatio(mark.hz) * chartWidth}
					y1={CHART_PADDING_TOP}
					y2={CHART_PADDING_TOP + chartHeight}
					stroke={gridColor}
					strokeWidth={1}
					strokeDasharray='2 8'
					opacity={0.5}
				/>
			))}
			{AXIS_LABELS_DB.map((levelDb) => (
				<SvgText
					key={`axis-${levelDb}`}
					x={CHART_PADDING_LEFT - 6}
					y={yForLevel(levelDb) + 3}
					fill={labelColor}
					fontSize={9}
					textAnchor='end'
				>
					{levelDb > 0 ? `+${levelDb}` : `${levelDb}`}
				</SvgText>
			))}
			{FREQUENCY_MARKS.map((mark) => (
				<SvgText
					key={`label-${mark.hz}`}
					x={CHART_PADDING_LEFT + frequencyToRatio(mark.hz) * chartWidth}
					y={CURVE_HEIGHT - 6}
					fill={labelColor}
					fontSize={9}
					textAnchor='middle'
				>
					{mark.label}
				</SvgText>
			))}
		</Svg>
	)
})

export interface EqResponseCurveProps {
	bandGainSharedValues: readonly SharedValue<number>[]
	preampSharedValue: SharedValue<number>
	enabled: boolean
}

export default function EqResponseCurve({
	bandGainSharedValues,
	preampSharedValue,
	enabled,
}: EqResponseCurveProps) {
	const { colors } = useTheme()

	const [width, setWidth] = useState(0)

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		const nextWidth = event.nativeEvent.layout.width

		setWidth((previous) => (previous === nextWidth ? previous : nextWidth))
	}, [])

	const chartWidth = Math.max(
		width - CHART_PADDING_LEFT - CHART_PADDING_RIGHT,
		0,
	)

	const chartHeight = CURVE_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

	const centerY = CHART_PADDING_TOP + chartHeight / 2

	const scale = chartHeight / 2 / CURVE_RANGE_DB

	const xRatios = EQ_CURVE_TABLE.xRatios

	const pointXs = useMemo(
		() => xRatios.map((ratio) => CHART_PADDING_LEFT + ratio * chartWidth),
		[chartWidth, xRatios],
	)

	const lineBuilderSeed = useMemo(() => Skia.PathBuilder.Make(), [])

	const fillBuilderSeed = useMemo(() => Skia.PathBuilder.Make(), [])

	const lineBuilder = useSharedValue(lineBuilderSeed)

	const fillBuilder = useSharedValue(fillBuilderSeed)

	const responseDb = useDerivedValue(() => {
		const gains = new Array<number>(bandGainSharedValues.length)

		for (let index = 0; index < bandGainSharedValues.length; index += 1) {
			gains[index] = bandGainSharedValues[index].get()
		}

		return evaluateEqResponseWorklet(
			gains,
			preampSharedValue.get(),
			EQ_CURVE_TABLE,
		)
	}, [bandGainSharedValues, preampSharedValue])

	const linePath = useDerivedValue(() => {
		const builder = lineBuilder.get()

		builder.reset()

		appendCurveToBuilder(builder, responseDb.get(), pointXs, centerY, scale)

		return builder.build()
	}, [centerY, lineBuilder, pointXs, responseDb, scale])

	const fillPath = useDerivedValue(() => {
		const builder = fillBuilder.get()

		builder.reset()

		appendCurveToBuilder(builder, responseDb.get(), pointXs, centerY, scale)

		const pointCount = pointXs.length

		if (pointCount > 0) {
			builder.lineTo(pointXs[pointCount - 1], centerY)

			builder.lineTo(pointXs[0], centerY)

			builder.close()
		}

		return builder.build()
	}, [centerY, fillBuilder, pointXs, responseDb, scale])

	const strokeColor = enabled ? colors.primary : colors.outline

	const fillTopColor = useMemo(
		() =>
			Color(strokeColor)
				.alpha(enabled ? 0.32 : 0.12)
				.string(),
		[enabled, strokeColor],
	)

	const fillBottomColor = useMemo(
		() => Color(strokeColor).alpha(0).string(),
		[strokeColor],
	)

	const gradientStart = useMemo(() => vec(0, CHART_PADDING_TOP), [])

	const gradientEnd = useMemo(
		() => vec(0, CHART_PADDING_TOP + chartHeight),
		[chartHeight],
	)

	const hasChart = chartWidth > 0

	return (
		<View
			style={styles.container}
			onLayout={handleLayout}
		>
			{hasChart ? (
				<>
					<StaticChart
						width={width}
						chartWidth={chartWidth}
						gridColor={colors.outlineVariant}
						zeroLineColor={colors.outline}
						labelColor={colors.onSurfaceVariant}
					/>
					<Canvas
						pointerEvents='none'
						style={StyleSheet.absoluteFill}
					>
						<Path
							path={fillPath}
							style='fill'
						>
							<LinearGradient
								start={gradientStart}
								end={gradientEnd}
								colors={[fillTopColor, fillBottomColor]}
							/>
						</Path>
						<Path
							path={linePath}
							style='stroke'
							strokeWidth={enabled ? 2.5 : 1.5}
							strokeCap='round'
							strokeJoin='round'
							color={strokeColor}
							opacity={enabled ? 1 : 0.7}
						/>
					</Canvas>
				</>
			) : (
				<View style={styles.placeholder} />
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		height: CURVE_HEIGHT,
		width: '100%',
	},
	placeholder: {
		height: CURVE_HEIGHT,
	},
})
