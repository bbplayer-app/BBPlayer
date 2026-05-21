import { requireNativeView } from 'expo'
import { createElement } from 'react'
import { Platform } from 'react-native'

import type { WavySliderProps } from './ExpoWavySlider.types'
import useNativeNumberProp, {
	type NativeNumberProp,
} from './hooks/useNativeNumberProp'
import useObservableStateAdapter from './hooks/useObservableStateAdapter'
import useWorkletProp from './hooks/useWorkletProp'
import getStateId from './utils/getStateId'

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
	waveLength?: NativeNumberProp
	waveHeight?: NativeNumberProp
	waveVelocity?: NativeNumberProp
	waveThickness?: NativeNumberProp
	trackThickness?: NativeNumberProp
	onValueChange?: number
	onValueChangeFinished?: number
	onDragStateChange?: number
}

const NativeWavySlider =
	Platform.OS === 'android'
		? requireNativeView<NativeWavySliderProps>(
				'ExpoWavySlider',
				'ExpoWavySliderView',
			)
		: null

export default function WavySlider({
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
	if (Platform.OS !== 'android' || !NativeWavySlider) {
		throw new Error(
			'[expo-wavy-slider] WavySlider is only implemented on Android.',
		)
	}

	const onValueChangeCallback = useWorkletProp(onValueChange, 'onValueChange')
	const onValueChangeFinishedCallback = useWorkletProp(
		onValueChangeFinished,
		'onValueChangeFinished',
	)
	const onDragStateChangeCallback = useWorkletProp(
		onDragStateChange,
		'onDragStateChange',
	)
	const progressState = useObservableStateAdapter(progress, value)
	const bufferedProgressState = useObservableStateAdapter(
		bufferedProgress,
		bufferedValue,
	)
	const nativeWaveLength = useNativeNumberProp(waveLength, 16)
	const nativeWaveHeight = useNativeNumberProp(waveHeight, 16)
	const nativeWaveVelocity = useNativeNumberProp(waveVelocity, 15)
	const nativeWaveThickness = useNativeNumberProp(waveThickness, 4)
	const nativeTrackThickness = useNativeNumberProp(trackThickness, 4)

	return createElement(NativeWavySlider, {
		...props,
		value,
		progress: getStateId(progressState),
		bufferedValue,
		bufferedProgress: getStateId(bufferedProgressState),
		min,
		max,
		enabled,
		waveLength: nativeWaveLength,
		waveHeight: nativeWaveHeight,
		waveVelocity: nativeWaveVelocity,
		waveDirection,
		waveThickness: nativeWaveThickness,
		trackThickness: nativeTrackThickness,
		incremental,
		onValueChange: getStateId(onValueChangeCallback),
		onValueChangeFinished: getStateId(onValueChangeFinishedCallback),
		onDragStateChange: getStateId(onDragStateChangeCallback),
	})
}
