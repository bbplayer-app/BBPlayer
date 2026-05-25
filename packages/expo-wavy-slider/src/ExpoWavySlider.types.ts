import type { ColorValue, ViewProps } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import type { ObservableState } from './hooks/useNativeState'

/**
 * Color configuration for the Android WavySlider.
 *
 * Any omitted color falls back to the Compose Material3 Slider defaults.
 */
export type WavySliderColors = {
	/**
	 * Thumb color.
	 */
	thumbColor?: ColorValue
	/**
	 * Track color for the selected range, from `min` to the current value.
	 */
	activeTrackColor?: ColorValue
	/**
	 * Track color for the unselected range, from the current value to `max`.
	 */
	inactiveTrackColor?: ColorValue
	/**
	 * Active tick color. Steps are not exposed yet, but this keeps the color
	 * model aligned with Material Slider.
	 */
	activeTickColor?: ColorValue
	/**
	 * Inactive tick color. Steps are not exposed yet, but this keeps the color
	 * model aligned with Material Slider.
	 */
	inactiveTickColor?: ColorValue
	/**
	 * Track color for buffered or loaded progress.
	 *
	 * This is drawn only between the current value and `bufferedValue`; it does
	 * not cover the active wave before the current value.
	 */
	bufferedTrackColor?: ColorValue
}

/**
 * Direction used by the animated wave.
 *
 * - `left`: Always moves left.
 * - `right`: Always moves right.
 * - `tail`: Moves toward the start of the track and follows layout direction.
 * - `head`: Moves toward the thumb and follows layout direction.
 */
export type WavySliderWaveDirection = 'left' | 'right' | 'tail' | 'head'

/**
 * Shape used for the slider thumb.
 *
 * - `default`: Material 3 default thumb.
 * - `circle`: Circular thumb.
 * - `square`: Square thumb.
 * - `diamond`: Square thumb rotated by 45 degrees, matching the upstream demo.
 */
export type WavySliderThumbShape = 'default' | 'circle' | 'square' | 'diamond'

/**
 * A value that can be updated from the UI runtime.
 *
 * Shared values are bridged to an internal ObservableState with Reanimated
 * `startMapper()`. ObservableState values are passed through directly.
 */
export type WavySliderAnimatedValue<T> = SharedValue<T> | ObservableState<T>

/**
 * A numeric slider prop.
 *
 * Pass a plain number for static values, or pass a Reanimated
 * `SharedValue<number>` / `ObservableState<number>` for values that should
 * update from the UI runtime.
 */
export type WavySliderNumberValue = number | WavySliderAnimatedValue<number>

/**
 * Progress values are expected to be driven from the UI runtime.
 *
 * Pass either a Reanimated `SharedValue<number>` or an
 * `ObservableState<number>`.
 */
export type WavySliderProgressValue = WavySliderAnimatedValue<number>

/**
 * Props for the Android WavySlider view.
 *
 * The component supports two update modes:
 *
 * - Regular prop mode: use `value` / `bufferedValue` for low-frequency updates.
 * - Native state mode: use `progress` / `bufferedProgress` for high-frequency
 *   updates such as media playback progress, bypassing React renders and
 *   updating Compose directly.
 */
export type WavySliderProps = ViewProps & {
	/**
	 * Current slider value.
	 *
	 * When `progress` is provided, `progress.value` takes precedence and this
	 * field is used only as the fallback value.
	 *
	 * @default 0
	 */
	value?: number
	/**
	 * Native or shared progress state for the current value.
	 *
	 * Pass a Reanimated `SharedValue<number>` or an `ObservableState<number>` to
	 * drive the native Compose UI directly, avoiding React re-renders for
	 * high-frequency progress updates.
	 */
	progress?: WavySliderProgressValue
	/**
	 * Buffered or loaded progress value.
	 *
	 * When `bufferedProgress` is provided, `bufferedProgress.value` takes
	 * precedence and this field is used only as the fallback value.
	 *
	 * @default 0
	 */
	bufferedValue?: number
	/**
	 * Native or shared state for buffered or loaded progress.
	 *
	 * This works like `progress` and is intended for buffered progress updates
	 * that do not need to pass through React.
	 */
	bufferedProgress?: WavySliderProgressValue
	/**
	 * Minimum selectable value.
	 *
	 * `value`, `progress.value`, `bufferedValue`, and `bufferedProgress.value`
	 * are normalized and clamped against this range.
	 *
	 * @default 0
	 */
	min?: number
	/**
	 * Maximum selectable value.
	 *
	 * @default 1
	 */
	max?: number
	/**
	 * Lower bound for user interaction.
	 *
	 * The stricter value between this prop and `min` is used.
	 */
	lowerLimit?: number
	/**
	 * Upper bound for user interaction.
	 *
	 * The stricter value between this prop and `max` is used.
	 */
	upperLimit?: number
	/**
	 * Whether user interaction is enabled.
	 *
	 * @default true
	 */
	enabled?: boolean
	/**
	 * Color configuration.
	 */
	colors?: WavySliderColors
	/**
	 * Wave length in dp.
	 *
	 * Set this to `0` to render a regular straight slider.
	 *
	 * @default 16
	 */
	waveLength?: WavySliderNumberValue
	/**
	 * Wave height in dp.
	 *
	 * Set this to `0` to render a regular straight slider. Pass a
	 * `SharedValue<number>` or `ObservableState<number>` if you want to animate
	 * pause flattening, drag flattening, or other effects from a worklet.
	 *
	 * @default 16
	 */
	waveHeight?: WavySliderNumberValue
	/**
	 * Wave velocity in dp per second.
	 *
	 * Set this to `0` to stop the wave, which is useful for paused media.
	 * Pass a `SharedValue<number>` or `ObservableState<number>` to animate
	 * between playback states from a worklet.
	 *
	 * @default 15
	 */
	waveVelocity?: WavySliderNumberValue
	/**
	 * Wave movement direction.
	 *
	 * @default 'head'
	 */
	waveDirection?: WavySliderWaveDirection
	/**
	 * Shape used for the slider thumb.
	 *
	 * @default 'default'
	 */
	thumbShape?: WavySliderThumbShape
	/**
	 * Stroke thickness for the active wave in dp.
	 *
	 * @default 4
	 */
	waveThickness?: WavySliderNumberValue
	/**
	 * Stroke thickness for the inactive and buffered tracks in dp.
	 *
	 * @default 4
	 */
	trackThickness?: WavySliderNumberValue
	/**
	 * Whether the wave height gradually increases from the track start toward
	 * the thumb.
	 *
	 * @default false
	 */
	incremental?: boolean
	/**
	 * High-frequency callback fired while the value is changing.
	 *
	 * This must be a worklet function.
	 */
	onValueChange?: (value: number) => void
	/**
	 * Callback fired when the user finishes dragging or tap-seeking.
	 *
	 * This must be a worklet function.
	 */
	onValueChangeFinished?: (value: number) => void
	/**
	 * Callback fired when the native dragging state changes.
	 *
	 * This mirrors Compose `interactionSource.collectIsDraggedAsState()`. It
	 * must be a worklet function and is useful for writing the drag state into a
	 * Reanimated shared value, then driving ObservableState props such as
	 * `waveHeight`, `waveThickness`, and `trackThickness` from the UI runtime.
	 */
	onDragStateChange?: (isDragged: boolean) => void
}
