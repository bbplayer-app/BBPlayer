// Registers the custom serializer required for SharedObject values in worklets.
// oxlint-disable-next-line
import './worklets.fx'

export type {
	WavySliderAnimatedValue,
	WavySliderColors,
	WavySliderNumberValue,
	WavySliderProgressValue,
	WavySliderProps,
} from './ExpoWavySlider.types'
export { default as useNativeState } from './hooks/useNativeState'
export { default as useWorkletProp } from './hooks/useWorkletProp'
export { default as WavySlider } from './WavySlider'
