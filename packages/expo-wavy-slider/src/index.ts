// 用于初始化 worklets 的自定义 Serializer
// oxlint-disable-next-line
import './worklets.fx'

import { requireNativeView } from 'expo'
import { createElement } from 'react'

import type {
	ObservableNumber,
	WavySliderColors,
	WavySliderProps,
} from './ExpoWavySlider.types'
import useWorkletProp from './hooks/useWorkletProp'
import getStateId from './utils/getStateId'

// WavySliderProps 中的这几个 props 是 SharedObject，但实际传递给组件时应该转为 __expo_shared_object_id__
type NativeWavySliderProps = Omit<
	WavySliderProps,
	| 'progress'
	| 'bufferedProgress'
	| 'waveLength'
	| 'waveHeight'
	| 'waveVelocity'
	| 'waveThickness'
	| 'trackThickness'
	| 'onValueChange'
	| 'onValueChangeFinished'
	| 'onDragStateChange'
> & {
	progress?: number
	bufferedProgress?: number
	waveLength?: NativeObservableNumber
	waveHeight?: NativeObservableNumber
	waveVelocity?: NativeObservableNumber
	waveThickness?: NativeObservableNumber
	trackThickness?: NativeObservableNumber
	onValueChange?: number
	onValueChangeFinished?: number
	onDragStateChange?: number
}

type NativeObservableNumber = number | { stateId: number }

const NativeWavySlider = requireNativeView<NativeWavySliderProps>(
	'ExpoWavySlider',
	'ExpoWavySliderView',
)

function WavySlider({
	progress,
	bufferedProgress,
	onValueChange,
	onValueChangeFinished,
	onDragStateChange,
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
	...props
}: WavySliderProps) {
	const onValueChangeCallback = useWorkletProp(onValueChange, 'onValueChange')
	const onValueChangeFinishedCallback = useWorkletProp(
		onValueChangeFinished,
		'onValueChangeFinished',
	)
	const onDragStateChangeCallback = useWorkletProp(
		onDragStateChange,
		'onDragStateChange',
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
		waveLength: normalizeObservableNumber(waveLength),
		waveHeight: normalizeObservableNumber(waveHeight),
		waveVelocity: normalizeObservableNumber(waveVelocity),
		waveDirection,
		waveThickness: normalizeObservableNumber(waveThickness),
		trackThickness: normalizeObservableNumber(trackThickness),
		incremental,
		onValueChange: getStateId(onValueChangeCallback),
		onValueChangeFinished: getStateId(onValueChangeFinishedCallback),
		onDragStateChange: getStateId(onDragStateChangeCallback),
	})
}

function normalizeObservableNumber(
	value: ObservableNumber,
): NativeObservableNumber {
	if (typeof value === 'number') {
		return value
	}
	const id = getStateId(value)
	if (id == null) {
		throw new Error('Observable number prop received an invalid native state.')
	}
	return { stateId: id }
}

export type { ObservableNumber, WavySliderProps, WavySliderColors }
export { default as useNativeState } from './hooks/useNativeState'
export { default as useWorkletProp } from './hooks/useWorkletProp'
export { WavySlider }
