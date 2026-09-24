import { FillType, Path, Skia } from '@shopify/react-native-skia'
import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import {
	Easing,
	useDerivedValue,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { Pie, PolarChart, type PieSliceData } from 'victory-native'

export interface StorageSegment {
	color: string
	label: string
	value: number
}

const CHART_SIZE = 208
const INNER_RADIUS = CHART_SIZE * 0.29
/** Start the first slice at the 12 o'clock position. */
const START_ANGLE = -90
const ANIMATION_DURATION = 900

interface AnimatedSliceProps {
	progress: SharedValue<number>
	slice: PieSliceData
}

/**
 * A pie slice whose sweep angle is driven by a Reanimated shared value, so the whole chart
 * "fills up" on the UI thread without re-rendering React on every frame.
 */
function AnimatedSlice({ slice, progress }: AnimatedSliceProps) {
	// Extract plain numbers: Victory stores the center as a Skia host object, which cannot be
	// captured by a worklet.
	const centerX = slice.center.x
	const centerY = slice.center.y
	const radius = slice.radius
	const innerRadius = slice.innerRadius
	const startAngle = slice.startAngle
	const endAngle = slice.endAngle

	const path = useDerivedValue(() => {
		const factor = progress.get()
		// Unfold clockwise from the fixed start edge instead of scaling the absolute angles.
		const start = START_ANGLE + (startAngle - START_ANGLE) * factor
		const end = START_ANGLE + (endAngle - START_ANGLE) * factor
		const sweep = end - start

		const builder = Skia.PathBuilder.Make()
		const outer = Skia.XYWHRect(
			centerX - radius,
			centerY - radius,
			radius * 2,
			radius * 2,
		)

		if (sweep >= 359.999) {
			builder.addOval(outer)
			if (innerRadius > 0) {
				builder.addOval(
					Skia.XYWHRect(
						centerX - innerRadius,
						centerY - innerRadius,
						innerRadius * 2,
						innerRadius * 2,
					),
				)
				builder.setFillType(FillType.EvenOdd)
			}
		} else if (sweep > 0.01) {
			builder.arcToOval(outer, start, sweep, false)
			if (innerRadius > 0) {
				builder.arcToOval(
					Skia.XYWHRect(
						centerX - innerRadius,
						centerY - innerRadius,
						innerRadius * 2,
						innerRadius * 2,
					),
					end,
					-sweep,
					false,
				)
			} else {
				builder.lineTo(centerX, centerY)
			}
		}

		return builder.build()
	}, [centerX, centerY, radius, innerRadius, startAngle, endAngle, progress])

	return (
		<Path
			path={path}
			color={slice.color}
			style='fill'
		/>
	)
}

interface StorageUsageChartProps {
	segments: StorageSegment[]
	totalLabel: string
}

export default function StorageUsageChart({
	segments,
	totalLabel,
}: StorageUsageChartProps) {
	const { colors } = useTheme()
	const progress = useSharedValue(0)

	const data = useMemo(
		() =>
			segments
				.filter((segment) => segment.value > 0)
				.map((segment) => ({
					label: segment.label,
					value: segment.value,
					color: segment.color,
				})),
		[segments],
	)

	useEffect(() => {
		progress.set(
			withTiming(1, {
				duration: ANIMATION_DURATION,
				easing: Easing.out(Easing.cubic),
			}),
		)
	}, [progress])

	return (
		<View style={styles.container}>
			<View style={styles.chartBox}>
				{data.length > 0 ? (
					<PolarChart
						data={data}
						labelKey='label'
						valueKey='value'
						colorKey='color'
						explicitSize={{ width: CHART_SIZE, height: CHART_SIZE }}
					>
						<Pie.Chart
							innerRadius={INNER_RADIUS}
							startAngle={START_ANGLE}
						>
							{({ slice }) => (
								<AnimatedSlice
									slice={slice}
									progress={progress}
								/>
							)}
						</Pie.Chart>
					</PolarChart>
				) : (
					<View
						style={[styles.emptyRing, { borderColor: colors.surfaceVariant }]}
					/>
				)}
				<View
					pointerEvents='none'
					style={styles.centerLabel}
				>
					<Text
						variant='labelSmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						总占用
					</Text>
					<Text
						variant='titleMedium'
						style={styles.centerValue}
					>
						{totalLabel}
					</Text>
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	chartBox: {
		alignItems: 'center',
		height: CHART_SIZE,
		justifyContent: 'center',
		width: CHART_SIZE,
	},
	centerLabel: {
		alignItems: 'center',
		bottom: 0,
		justifyContent: 'center',
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0,
	},
	centerValue: {
		fontWeight: '700',
	},
	emptyRing: {
		borderRadius: CHART_SIZE / 2,
		borderWidth: CHART_SIZE * 0.29,
		height: CHART_SIZE,
		width: CHART_SIZE,
	},
})
