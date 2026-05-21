// 用于初始化 worklets 的自定义 Serializer
// oxlint-disable-next-line
import './worklets.fx'

import { requireNativeView } from 'expo'
import { createElement } from 'react'

import type { WavySliderColors, WavySliderProps } from './ExpoWavySlider.types'
import useWorkletProp from './hooks/useWorkletProp'
import getStateId from './utils/getStateId'

// WavySliderProps 中的这几个 props 是 SharedObject，但实际传递给组件时应该转为 __expo_shared_object_id__
type NativeWavySliderProps = Omit<
	WavySliderProps,
	'progress' | 'bufferedProgress' | 'onValueChange' | 'onValueChangeFinished'
> & {
	progress?: number
	bufferedProgress?: number
	onValueChange?: number
	onValueChangeFinished?: number
}

const NativeWavySlider = requireNativeView<NativeWavySliderProps>(
	'ExpoWavySlider',
	'ExpoWavySliderView',
)

function WavySlider({
	progress,
	bufferedProgress,
	onValueChange,
	onValueChangeFinished,
	value = 0,
	bufferedValue = 0,
	min = 0,
	max = 1,
	enabled = true,
	waveLength = 16,
	waveHeight = 16,
	waveVelocity = 15,
	waveDirection = 'head',
	waveThickness = 4,
	trackThickness = 4,
	incremental = false,
	flattenOnDrag = false,
	flattenedWaveHeight = 0,
	flattenAnimationDurationMs = 100,
	restoreWaveHeightAnimationDurationMs = 300,
	expandTrackOnDrag = false,
	draggedTrackThickness = 12,
	trackExpansionAnimationDurationMs = 200,
	trackRestoreAnimationDurationMs = 200,
	waveAppearanceAnimationDurationMs = 6000,
	...props
}: WavySliderProps) {
	const onValueChangeCallback = useWorkletProp(onValueChange, 'onValueChange')
	const onValueChangeFinishedCallback = useWorkletProp(
		onValueChangeFinished,
		'onValueChangeFinished',
	)

	return createElement(NativeWavySlider, {
		...props,
		value,
		progress: getStateId(progress),
		bufferedValue,
		bufferedProgress: getStateId(bufferedProgress),
		min,
		max,
		enabled,
		waveLength,
		waveHeight,
		waveVelocity,
		waveDirection,
		waveThickness,
		trackThickness,
		incremental,
		flattenOnDrag,
		flattenedWaveHeight,
		flattenAnimationDurationMs,
		restoreWaveHeightAnimationDurationMs,
		expandTrackOnDrag,
		draggedTrackThickness,
		trackExpansionAnimationDurationMs,
		trackRestoreAnimationDurationMs,
		waveAppearanceAnimationDurationMs,
		onValueChange: getStateId(onValueChangeCallback),
		onValueChangeFinished: getStateId(onValueChangeFinishedCallback),
	})
}

export type { WavySliderProps, WavySliderColors }
export { default as useNativeState } from './hooks/useNativeState'
export { default as useWorkletProp } from './hooks/useWorkletProp'
export { WavySlider }
