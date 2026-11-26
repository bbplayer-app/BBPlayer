import {
	EQ_BAND_LABELS,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
} from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccessibilityActionEvent } from 'react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import AnimateableText from 'react-native-animateable-text'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import * as Haptics from '@/utils/haptics'

const TRACK_HEIGHT = 176

const TRACK_CENTER_Y = TRACK_HEIGHT / 2

const TRACK_WIDTH = 4

const TRACK_HIT_WIDTH = 30

const THUMB_SIZE = 18

const COLUMN_MIN_WIDTH = 32

const GAIN_MIN_DB = EQ_MIN_GAIN_DB

const GAIN_MAX_DB = EQ_MAX_GAIN_DB

const GAIN_RANGE_DB = GAIN_MAX_DB - GAIN_MIN_DB

const GAIN_STEP_DB = 0.5

const NATIVE_SEND_THROTTLE_MS = 50

const DOUBLE_TAP_INTERVAL_MS = 320

const ACCESSIBILITY_STEP_DB = 1

const SNAP_DURATION_MS = 60

const RESET_DURATION_MS = 180

const ACCESSIBILITY_ANIMATION_MS = 120

function quantizeGainDb(gainDb: number): number {
	'worklet'

	const stepped = Math.round(gainDb / GAIN_STEP_DB) * GAIN_STEP_DB

	return Math.min(GAIN_MAX_DB, Math.max(GAIN_MIN_DB, stepped))
}

function gainToY(gainDb: number): number {
	'worklet'

	return ((GAIN_MAX_DB - gainDb) / GAIN_RANGE_DB) * TRACK_HEIGHT
}

function yToGain(y: number): number {
	'worklet'

	const clampedY = Math.min(Math.max(y, 0), TRACK_HEIGHT)

	return GAIN_MAX_DB - (clampedY / TRACK_HEIGHT) * GAIN_RANGE_DB
}

function formatGainDb(gainDb: number): string {
	'worklet'

	const magnitude = Math.abs(gainDb).toFixed(1)

	if (gainDb > 0) return `+${magnitude}`

	if (gainDb < 0) return `-${magnitude}`

	return magnitude
}

export interface EqBandSlidersProps {
	gainsDb: readonly number[]
	bandGainSharedValues: readonly SharedValue<number>[]
	enabled: boolean
	onBandChange: (index: number, gainDb: number) => void
	onBandCommit: (index: number, gainDb: number) => void
	onDragActiveChange: (active: boolean) => void
}

interface BandSliderProps {
	index: number
	label: string
	gainDb: number
	enabled: boolean
	gainSharedValue: SharedValue<number>
	onChange: (index: number, gainDb: number) => void
	onCommit: (index: number, gainDb: number) => void
	onDragActiveChange: (index: number, active: boolean) => void
}

function BandSlider({
	index,
	label,
	gainDb,
	enabled,
	gainSharedValue,
	onChange,
	onCommit,
	onDragActiveChange,
}: BandSliderProps) {
	const { colors, fonts } = useTheme()

	const moved = useSharedValue(false)

	const lastTapAt = useSharedValue(0)

	const lastNativeSendAt = useSharedValue(0)

	const lastSentGainDb = useSharedValue(gainDb)

	const panGesture = usePanGesture({
		minDistance: 0,
		shouldCancelWhenOutside: false,
		onBegin: (event) => {
			cancelAnimation(gainSharedValue)

			moved.set(false)

			lastNativeSendAt.set(0)

			const gain = yToGain(event.y)

			gainSharedValue.set(gain)

			const quantized = quantizeGainDb(gain)

			lastSentGainDb.set(quantized)

			scheduleOnRN(onDragActiveChange, index, true)

			scheduleOnRN(onChange, index, quantized)
		},
		onUpdate: (event) => {
			moved.set(true)

			const gain = yToGain(event.y)

			gainSharedValue.set(gain)

			const now = Date.now()

			if (now - lastNativeSendAt.get() < NATIVE_SEND_THROTTLE_MS) return

			lastNativeSendAt.set(now)

			const quantized = quantizeGainDb(gain)

			if (quantized === lastSentGainDb.get()) return

			lastSentGainDb.set(quantized)

			scheduleOnRN(onChange, index, quantized)
		},
		onFinalize: (event) => {
			scheduleOnRN(onDragActiveChange, index, false)

			const now = Date.now()

			const isTap = !moved.get()

			const isSecondTap =
				isTap && now - lastTapAt.get() <= DOUBLE_TAP_INTERVAL_MS

			if (isSecondTap) {
				lastTapAt.set(0)

				lastSentGainDb.set(0)

				gainSharedValue.set(
					withTiming(0, {
						duration: RESET_DURATION_MS,
						easing: Easing.out(Easing.cubic),
					}),
				)

				scheduleOnRN(
					Haptics.performHaptics,
					Haptics.AndroidHaptics.Context_Click,
				)

				scheduleOnRN(onCommit, index, 0)

				return
			}

			lastTapAt.set(isTap ? now : 0)

			const target = quantizeGainDb(yToGain(event.y))

			lastSentGainDb.set(target)

			gainSharedValue.set(
				withTiming(target, {
					duration: SNAP_DURATION_MS,
					easing: Easing.out(Easing.quad),
				}),
			)

			scheduleOnRN(onCommit, index, target)
		},
	})

	const handleAccessibilityAction = useCallback(
		(event: AccessibilityActionEvent) => {
			const delta =
				event.nativeEvent.actionName === 'increment'
					? ACCESSIBILITY_STEP_DB
					: -ACCESSIBILITY_STEP_DB

			const nextGainDb = quantizeGainDb(gainSharedValue.get() + delta)

			gainSharedValue.set(
				withTiming(nextGainDb, { duration: ACCESSIBILITY_ANIMATION_MS }),
			)

			onChange(index, nextGainDb)

			onCommit(index, nextGainDb)
		},
		[gainSharedValue, index, onChange, onCommit],
	)

	const thumbStyle = useAnimatedStyle(() => ({
		top: gainToY(gainSharedValue.get()) - THUMB_SIZE / 2,
	}))

	const fillStyle = useAnimatedStyle(() => {
		const valueY = gainToY(gainSharedValue.get())

		return {
			top: Math.min(valueY, TRACK_CENTER_Y),
			height: Math.abs(TRACK_CENTER_Y - valueY),
		}
	})

	const valueProps = useAnimatedProps(() => ({
		text: formatGainDb(quantizeGainDb(gainSharedValue.get())),
	}))

	const activeColor = enabled ? colors.primary : colors.outline

	const valueColor = enabled ? colors.onSurface : colors.onSurfaceVariant

	return (
		<View style={styles.column}>
			<AnimateableText
				numberOfLines={1}
				allowFontScaling={false}
				text={formatGainDb(gainDb)}
				animatedProps={valueProps}
				style={[fonts.labelSmall, styles.valueLabel, { color: valueColor }]}
			/>
			<GestureDetector gesture={panGesture}>
				<View
					accessible
					accessibilityRole='adjustable'
					accessibilityLabel={`${label} 赫兹频段`}
					accessibilityValue={{ text: `${formatGainDb(gainDb)} 分贝` }}
					accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
					onAccessibilityAction={handleAccessibilityAction}
					style={styles.trackHitArea}
				>
					<View
						style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
					/>
					<Animated.View
						style={[styles.fill, { backgroundColor: activeColor }, fillStyle]}
					/>
					<Animated.View
						style={[styles.thumb, { backgroundColor: activeColor }, thumbStyle]}
					/>
				</View>
			</GestureDetector>
			<Text
				variant='labelSmall'
				style={[styles.frequencyLabel, { color: colors.onSurfaceVariant }]}
			>
				{label}
			</Text>
		</View>
	)
}

export default function EqBandSliders({
	gainsDb,
	bandGainSharedValues,
	enabled,
	onBandChange,
	onBandCommit,
	onDragActiveChange,
}: EqBandSlidersProps) {
	const activeDragsRef = useRef(new Set<number>())

	const [isAnyBandDragging, setIsAnyBandDragging] = useState(false)

	const handleDragActiveChange = useCallback(
		(index: number, active: boolean) => {
			const activeDrags = activeDragsRef.current

			const wasDragging = activeDrags.size > 0

			if (active) {
				activeDrags.add(index)
			} else {
				activeDrags.delete(index)
			}

			const isDragging = activeDrags.size > 0

			if (wasDragging === isDragging) return

			setIsAnyBandDragging(isDragging)

			onDragActiveChange(isDragging)
		},
		[onDragActiveChange],
	)

	useEffect(() => {
		const activeDrags = activeDragsRef.current

		return () => {
			activeDrags.clear()
		}
	}, [])

	return (
		<ScrollView
			horizontal
			scrollEnabled={!isAnyBandDragging}
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.content}
		>
			{EQ_BAND_LABELS.map((label, index) => (
				<BandSlider
					key={label}
					index={index}
					label={label}
					gainDb={gainsDb[index] ?? 0}
					enabled={enabled}
					gainSharedValue={bandGainSharedValues[index]}
					onChange={onBandChange}
					onCommit={onBandCommit}
					onDragActiveChange={handleDragActiveChange}
				/>
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		flexGrow: 1,
		gap: 2,
		paddingVertical: 4,
	},
	column: {
		alignItems: 'center',
		flexBasis: 0,
		flexGrow: 1,
		gap: 6,
		minWidth: COLUMN_MIN_WIDTH,
	},
	valueLabel: {
		fontVariant: ['tabular-nums'],
	},
	trackHitArea: {
		alignItems: 'center',
		height: TRACK_HEIGHT,
		width: TRACK_HIT_WIDTH,
	},
	track: {
		borderRadius: TRACK_WIDTH / 2,
		height: TRACK_HEIGHT,
		position: 'absolute',
		width: TRACK_WIDTH,
	},
	fill: {
		borderRadius: TRACK_WIDTH / 2,
		position: 'absolute',
		width: TRACK_WIDTH,
	},
	thumb: {
		borderRadius: THUMB_SIZE / 2,
		elevation: 2,
		height: THUMB_SIZE,
		position: 'absolute',
		width: THUMB_SIZE,
	},
	frequencyLabel: {
		opacity: 0.85,
	},
})
