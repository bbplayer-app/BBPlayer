import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import Svg, { Circle, Path } from 'react-native-svg'

export interface TrackNecessaryData {
	cover?: string
	artistCover?: string
	title: string
	duration: number
	id: number
	artistName?: string
	uniqueKey: string
	progress: number // -1 为播放完
}

const RING_RADIUS = 10
const RING_STROKE = 2.5
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2
const RING_CENTER = RING_RADIUS + RING_STROKE
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface ProgressRingProps {
	progressInSeconds?: number
	durationInSeconds: number
}

/**
 * 播放进度小圆环
 * 95% 以上显示高亮圆环 + 对钩
 */
const ProgressRing = memo(function ProgressRing({
	progressInSeconds,
	durationInSeconds,
}: ProgressRingProps) {
	const { colors } = useTheme()
	const progress = progressInSeconds ?? 0
	const duration = durationInSeconds || 0

	if (duration === 0) {
		return <View style={styles.progressRingContainer} />
	}

	let progressRatio = progress / duration
	progressRatio = Math.min(1, Math.max(0, progressRatio))

	const isComplete = progress === -1 || progressRatio >= 0.95
	const strokeOffset = RING_CIRCUMFERENCE * (1 - progressRatio)

	if (isComplete) {
		return (
			<View style={styles.progressRingContainer}>
				<Svg
					width={RING_SIZE}
					height={RING_SIZE}
					viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
				>
					<Circle
						cx={RING_CENTER}
						cy={RING_CENTER}
						r={RING_RADIUS}
						stroke={colors.primary}
						strokeWidth={RING_STROKE}
						fill='none'
					/>
				</Svg>
				<Svg
					width={16}
					height={16}
					viewBox='0 0 24 24'
					style={styles.progressRingIcon}
				>
					<Path
						d='M 6 12 L 10 16 L 18 8'
						fill='none'
						stroke={colors.primary}
						strokeWidth={3}
						strokeLinecap='round'
						strokeLinejoin='round'
					/>
				</Svg>
			</View>
		)
	}

	return (
		<View style={styles.progressRingContainer}>
			<Svg
				width={RING_SIZE}
				height={RING_SIZE}
				viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
			>
				<Circle
					cx={RING_CENTER}
					cy={RING_CENTER}
					r={RING_RADIUS}
					stroke={colors.elevation.level3}
					strokeWidth={RING_STROKE}
					fill='none'
				/>
				<Circle
					cx={RING_CENTER}
					cy={RING_CENTER}
					r={RING_RADIUS}
					stroke={colors.primary}
					strokeWidth={RING_STROKE}
					fill='none'
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={strokeOffset}
					strokeLinecap='round'
					transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
				/>
			</Svg>
		</View>
	)
})

const styles = StyleSheet.create({
	menuButton: {
		borderRadius: 99999,
		padding: 10,
	},

	progressRingContainer: {
		width: RING_SIZE,
		height: RING_SIZE,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 2,
		marginLeft: 8,
	},

	progressRingIcon: {
		position: 'absolute',
	},
})

export default ProgressRing
