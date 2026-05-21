import type { WavySliderNumberValue } from '../ExpoWavySlider.types'
import serializeObservableState, {
	type NativeObservableStateReference,
} from '../utils/serializeObservableState'

import useObservableStateAdapter, {
	isWavySliderAnimatedValue,
} from './useObservableStateAdapter'

export type NativeNumberProp = number | NativeObservableStateReference

/**
 * Converts a `WavySliderNumberValue` to a `NativeNumberProp`.
 */
export default function useNativeNumberProp(
	value: WavySliderNumberValue,
	initialValue: number,
): NativeNumberProp {
	const observableState = useObservableStateAdapter(
		isWavySliderAnimatedValue<number>(value) ? value : undefined,
		initialValue,
	)

	if (typeof value === 'number') return value
	return serializeObservableState(observableState)
}
