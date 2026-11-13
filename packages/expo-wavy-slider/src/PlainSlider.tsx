import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, StyleSheet, View, type ColorValue } from 'react-native'
import Animated, {
	Easing,
	isSharedValue,
	useAnimatedStyle,
	useDerivedValue,
	useFrameCallback,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnUI } from 'react-native-worklets'

import type {
	WavySliderNumberValue,
	WavySliderProps,
	WavySliderWaveDirection,
} from './ExpoWavySlider.types'

const THUMB_SIZE = 16

// Android keeps this much room between the thumb and both tracks.
const THUMB_TRACK_GAP = 6
const STOP_INDICATOR_RADIUS = 2
const MARKER_WIDTH = 2
const MARKER_HEIGHT = 12
const DEFAULT_ACTIVE_COLOR = '#fb7299'
const DEFAULT_INACTIVE_COLOR = 'rgba(127,127,127,0.3)'
const DEFAULT_WAVE_LENGTH = 20
const DEFAULT_THICKNESS = 4

// As on Android, the wave spreads out over six seconds after the slider appears.
const WAVE_SPREAD_DURATION = 6000
const FULL_TURN = Math.PI * 2

/** The way the wave travels along the x axis, for a left-to-right layout. */
function directionSign(direction: WavySliderWaveDirection): number {
	switch (direction) {
		case 'left':
		case 'tail':
			return 1
		case 'right':
		case 'head':
			return -1
	}
}

/** Skia draws CSS color strings, so React Native platform colors fall back. */
function skiaColor(color: ColorValue | undefined, fallback: string): string {
	return color !== undefined && String(color) === color ? color : fallback
}

/** Reads a number prop on the UI runtime, whether it arrives as a number or a shared value. */
function useNumberProp(
	value: WavySliderNumberValue | undefined,
	fallback: number,
): SharedValue<number> {
	const shared = isSharedValue<number>(value) ? value : undefined

	// Native observable states only exist on Android, so they use the fallback here.
	const plain =
		shared === undefined && Number(value) === value ? value : fallback

	const local = useSharedValue(plain)

	useEffect(() => {
		local.set(plain)
	}, [local, plain])

	return shared ?? local
}

/**
 * iOS has no Compose slider, so this draws the same track with Skia: a wave for the
 * played part that flows at the given velocity, a gap around the thumb, a flat
 * inactive track with a dot at its end, and the skin's thumb images.
 *
 * Callbacks are worklets, so they are dispatched to the UI runtime to match Android.
 */
export default function WavySlider({
	progress,
	onValueChange,
	onValueChangeFinished,
	onDragStateChange,
	value = 0,
	min = 0,
	max = 1,
	enabled = true,
	colors,
	style,
	chapterMarkers,
	dragging: outsideDragging,
	waveLength,
	waveHeight,
	waveVelocity,
	waveDirection = 'tail',
	waveThickness,
	trackThickness,
	thumbImageUri,
	thumbImageDragLeftUri,
	thumbImageDragRightUri,
	thumbImageSize = THUMB_SIZE,
	thumbImageOffsetX = 0,
	thumbImageOffsetY = 0,
}: WavySliderProps) {
	const range = max - min || 1
	const sharedProgress = isSharedValue<number>(progress) ? progress : undefined
	const trackWidth = useSharedValue(0)
	const trackHeight = useSharedValue(0)
	const dragging = useSharedValue(false)
	const dragFraction = useSharedValue(0)
	const [dragDirection, setDragDirection] = useState(0)

	const gesture = useRef({
		startX: 0,
		startPageX: 0,
		lastX: 0,
		lastValue: value,
	})

	const waveLengthValue = useNumberProp(waveLength, DEFAULT_WAVE_LENGTH)
	const waveHeightValue = useNumberProp(waveHeight, 0)
	const waveVelocityValue = useNumberProp(waveVelocity, 0)
	const waveThicknessValue = useNumberProp(waveThickness, DEFAULT_THICKNESS)
	const trackThicknessValue = useNumberProp(trackThickness, DEFAULT_THICKNESS)
	const waveShift = useSharedValue(0)
	const waveSpread = useSharedValue(0)
	const sign = directionSign(waveDirection)
	const thumbWidth = thumbImageUri ? thumbImageSize : THUMB_SIZE

	useEffect(() => {
		waveSpread.set(
			withTiming(1, {
				duration: WAVE_SPREAD_DURATION,
				easing: Easing.out(Easing.quad),
			}),
		)
	}, [waveSpread])

	useFrameCallback((frame) => {
		const velocity = waveVelocityValue.value

		if (velocity === 0 || waveHeightValue.value === 0) return
		waveShift.set(
			waveShift.get() +
				(velocity * sign * (frame.timeSincePreviousFrame ?? 0)) / 1000,
		)
	})

	const updateDrag = (x: number) => {
		const width = trackWidth.get()
		const fraction = width > 0 ? Math.min(Math.max(x / width, 0), 1) : 0
		const next = min + fraction * range
		const direction = Math.sign(x - gesture.current.lastX)

		// As on Android, the skin's thumb faces the way it is being dragged.
		if (direction !== 0) setDragDirection(direction)
		gesture.current.lastX = x
		gesture.current.lastValue = next
		dragFraction.set(fraction)

		if (onValueChange) scheduleOnUI(onValueChange, next)
	}

	const finishDrag = () => {
		dragging.set(false)
		setDragDirection(0)

		if (onValueChangeFinished) {
			scheduleOnUI(onValueChangeFinished, gesture.current.lastValue)
		}

		if (onDragStateChange) scheduleOnUI(onDragStateChange, false)
	}

	const fraction = useDerivedValue(() => {
		if (dragging.value) return dragFraction.value
		const current = sharedProgress ? sharedProgress.value : value

		return Math.min(Math.max((current - min) / range, 0), 1)
	})

	// SkPath is immutable, so paths are drawn with builders. As in Skia's own
	// usePathValue, they are made on the JS thread and reused on the UI thread.
	const activeBuilderSeed = useMemo(() => Skia.PathBuilder.Make(), [])
	const inactiveBuilderSeed = useMemo(() => Skia.PathBuilder.Make(), [])
	const activeBuilder = useSharedValue(activeBuilderSeed)
	const inactiveBuilder = useSharedValue(inactiveBuilderSeed)

	// The same curve as Android's createWavyPath, one point per point of width.
	const activePath = useDerivedValue(() => {
		const builder = activeBuilder.value.reset()
		const thickness = waveThicknessValue.value
		const centerY = trackHeight.value / 2
		const startX = thickness / 2

		const endX =
			fraction.value * trackWidth.value -
			thumbWidth / 2 -
			THUMB_TRACK_GAP -
			thickness / 2

		if (thickness <= 0 || endX <= startX) return builder.build()
		const length = waveLengthValue.value
		const amplitude = Math.abs(waveHeightValue.value) / 2

		if (length <= 0 || amplitude === 0) {
			builder.moveTo(startX, centerY)
			builder.lineTo(endX, centerY)

			return builder.build()
		}

		const turnsPerPoint = waveSpread.value / length
		const shift = waveShift.value

		const waveY = (offset: number) =>
			centerY +
			Math.sin((offset + shift) * turnsPerPoint * FULL_TURN) * amplitude

		builder.moveTo(startX, waveY(0))

		for (let x = startX + 1; x < endX; x++) builder.lineTo(x, waveY(x - startX))
		builder.lineTo(endX, waveY(endX - startX))

		return builder.build()
	})

	const inactiveStart = useDerivedValue(
		() =>
			fraction.value * trackWidth.value +
			thumbWidth / 2 +
			THUMB_TRACK_GAP +
			trackThicknessValue.value / 2,
	)

	const inactivePath = useDerivedValue(() => {
		const builder = inactiveBuilder.value.reset()
		const thickness = trackThicknessValue.value
		const centerY = trackHeight.value / 2
		const endX = trackWidth.value - thickness / 2

		if (thickness <= 0 || endX <= inactiveStart.value) return builder.build()
		builder.moveTo(inactiveStart.value, centerY)
		builder.lineTo(endX, centerY)

		return builder.build()
	})

	// Android marks the end of the track with a dot while the inactive track shows.
	const stopX = useDerivedValue(
		() =>
			trackWidth.value -
			Math.max(trackThicknessValue.value / 2, STOP_INDICATOR_RADIUS),
	)

	const trackCenterY = useDerivedValue(() => trackHeight.value / 2)

	const stopRadius = useDerivedValue(() =>
		inactiveStart.value < stopX.value - STOP_INDICATOR_RADIUS
			? STOP_INDICATOR_RADIUS
			: 0,
	)

	const thumbStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: fraction.value * trackWidth.value - thumbWidth / 2 },
			{ scale: dragging.value && !thumbImageUri ? 1.25 : 1 },
		],
	}))

	// As on Android, the markers grow out of the track only during a drag.
	const markersStyle = useAnimatedStyle(() => {
		const visible = dragging.value || outsideDragging?.value === true

		return {
			transform: [
				{
					scaleY: withTiming(visible ? 1 : 0, {
						duration: visible ? 180 : 120,
					}),
				},
			],
		}
	})

	const markers = [...new Set(chapterMarkers ?? [])].filter(
		(marker) => marker > 0 && marker < 1,
	)

	const activeColor = skiaColor(colors?.activeTrackColor, DEFAULT_ACTIVE_COLOR)

	const inactiveColor = skiaColor(
		colors?.inactiveTrackColor,
		DEFAULT_INACTIVE_COLOR,
	)

	const thumbUri =
		dragDirection < 0
			? (thumbImageDragLeftUri ?? thumbImageUri)
			: dragDirection > 0
				? (thumbImageDragRightUri ?? thumbImageUri)
				: thumbImageUri

	return (
		<View
			style={[styles.container, style]}
			onLayout={(event) => {
				trackWidth.set(event.nativeEvent.layout.width)
				trackHeight.set(event.nativeEvent.layout.height)
			}}
			onStartShouldSetResponder={() => enabled}
			onMoveShouldSetResponder={() => enabled}
			onResponderTerminationRequest={() => false}
			onResponderGrant={(event) => {
				gesture.current.startX = event.nativeEvent.locationX
				gesture.current.startPageX = event.nativeEvent.pageX
				gesture.current.lastX = event.nativeEvent.locationX
				dragging.set(true)

				if (onDragStateChange) scheduleOnUI(onDragStateChange, true)
				updateDrag(event.nativeEvent.locationX)
			}}
			onResponderMove={(event) => {
				updateDrag(
					gesture.current.startX +
						event.nativeEvent.pageX -
						gesture.current.startPageX,
				)
			}}
			onResponderRelease={finishDrag}
			onResponderTerminate={finishDrag}
		>
			<View
				pointerEvents='none'
				style={StyleSheet.absoluteFill}
			>
				<Canvas style={StyleSheet.absoluteFill}>
					<Path
						path={inactivePath}
						style='stroke'
						strokeWidth={trackThicknessValue}
						strokeCap='round'
						color={inactiveColor}
					/>
					<Path
						path={activePath}
						style='stroke'
						strokeWidth={waveThicknessValue}
						strokeCap='round'
						strokeJoin='round'
						color={activeColor}
					/>
					<Circle
						cx={stopX}
						cy={trackCenterY}
						r={stopRadius}
						color={activeColor}
					/>
				</Canvas>
			</View>
			{markers.length > 0 && (
				<Animated.View
					pointerEvents='none'
					style={[StyleSheet.absoluteFill, markersStyle]}
				>
					{markers.map((marker) => (
						<View
							key={marker}
							style={[
								styles.marker,
								{
									left: `${marker * 100}%`,
									backgroundColor: colors?.activeTickColor ?? activeColor,
								},
							]}
						/>
					))}
				</Animated.View>
			)}
			<Animated.View
				pointerEvents='none'
				style={[
					styles.thumb,
					{
						width: thumbWidth,
						height: thumbWidth,
						borderRadius: thumbWidth / 2,
					},
					thumbUri
						? null
						: { backgroundColor: colors?.thumbColor ?? activeColor },
					thumbStyle,
				]}
			>
				{thumbUri ? (
					<Image
						source={{ uri: thumbUri }}
						resizeMode='contain'
						style={{
							width: thumbImageSize,
							height: thumbImageSize,
							transform: [
								{ translateX: thumbImageOffsetX },
								{ translateY: thumbImageOffsetY },
							],
						}}
					/>
				) : null}
			</Animated.View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		justifyContent: 'center',
		minHeight: 28,
	},
	marker: {
		position: 'absolute',
		top: '50%',
		width: MARKER_WIDTH,
		height: MARKER_HEIGHT,
		marginLeft: -MARKER_WIDTH / 2,
		marginTop: -MARKER_HEIGHT / 2,
	},
	thumb: {
		position: 'absolute',
		left: 0,
	},
})
