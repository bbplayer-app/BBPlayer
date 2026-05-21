import type { ColorValue, ViewProps } from 'react-native'

import type { ObservableState } from './hooks/useNativeState'

/**
 * WavySlider 的颜色配置。
 *
 * 未传入的颜色会交给 Compose Material3 Slider 的默认颜色系统处理。
 */
export type WavySliderColors = {
	/**
	 * 手柄颜色。
	 */
	thumbColor?: ColorValue
	/**
	 * 当前进度区间的轨道颜色，也就是从最小值到当前 value 的波浪部分。
	 */
	activeTrackColor?: ColorValue
	/**
	 * 未播放/未选中区间的轨道颜色，也就是当前 value 到最大值的背景轨道。
	 */
	inactiveTrackColor?: ColorValue
	/**
	 * active tick 的颜色。当前组件暂未暴露 steps，但保留该字段以对齐 Material Slider 颜色模型。
	 */
	activeTickColor?: ColorValue
	/**
	 * inactive tick 的颜色。当前组件暂未暴露 steps，但保留该字段以对齐 Material Slider 颜色模型。
	 */
	inactiveTickColor?: ColorValue
	/**
	 * 缓冲/加载进度的轨道颜色。
	 *
	 * 该颜色只会绘制在当前 value 到 bufferedValue 之间，不会覆盖当前进度左侧的 active wave。
	 */
	bufferedTrackColor?: ColorValue
}

/**
 * 波浪移动方向。
 *
 * - `left`: 始终向左移动。
 * - `right`: 始终向右移动。
 * - `tail`: 向轨道起点方向移动，会跟随布局方向。
 * - `head`: 向手柄方向移动，会跟随布局方向。
 */
export type WavySliderWaveDirection = 'left' | 'right' | 'tail' | 'head'

/**
 * 可直接传普通数字，也可传 `useNativeState()` 创建的原生可观察状态。
 *
 * 传入 `ObservableState<number>` 后，可以在 worklet 中更新 `.value`，
 * 绕过 React 渲染直接驱动原生 Compose UI。
 */
export type ObservableNumber = number | ObservableState<number>

/**
 * Android WavySlider 组件属性。
 *
 * 组件支持两种更新模式：
 *
 * - 普通 prop 模式：使用 `value` / `bufferedValue`，适合低频更新。
 * - 原生状态模式：使用 `progress` / `bufferedProgress`，适合播放器进度这类高频更新，可绕过 React 渲染直接更新 Compose UI。
 */
export type WavySliderProps = ViewProps & {
	/**
	 * 当前进度值。
	 *
	 * 当传入 `progress` 时，`progress.value` 会优先作为当前进度；此字段仅作为兜底值。
	 *
	 * @default 0
	 */
	value?: number
	/**
	 * 当前进度的原生可观察状态。
	 *
	 * 传入后，JS/UI runtime 可以通过 `progress.value = nextValue` 直接驱动原生 Compose UI，
	 * 避免高频进度更新触发 React 重渲染。
	 */
	progress?: ObservableState<number>
	/**
	 * 缓冲/加载进度值。
	 *
	 * 当传入 `bufferedProgress` 时，`bufferedProgress.value` 会优先作为缓冲进度；此字段仅作为兜底值。
	 *
	 * @default 0
	 */
	bufferedValue?: number
	/**
	 * 缓冲/加载进度的原生可观察状态。
	 *
	 * 用法和 `progress` 相同，适合播放器缓冲进度这类高频但不需要经过 React 的 UI 更新。
	 */
	bufferedProgress?: ObservableState<number>
	/**
	 * 可选值范围的最小值。
	 *
	 * `value`、`progress.value`、`bufferedValue` 和 `bufferedProgress.value` 都会按该范围计算比例并裁剪。
	 *
	 * @default 0
	 */
	min?: number
	/**
	 * 可选值范围的最大值。
	 *
	 * @default 1
	 */
	max?: number
	/**
	 * 实际可拖动范围的下限。
	 *
	 * 该值会和 `min` 一起取更严格的下限。
	 */
	lowerLimit?: number
	/**
	 * 实际可拖动范围的上限。
	 *
	 * 该值会和 `max` 一起取更严格的上限。
	 */
	upperLimit?: number
	/**
	 * 是否允许用户交互。
	 *
	 * @default true
	 */
	enabled?: boolean
	/**
	 * 颜色配置。
	 */
	colors?: WavySliderColors
	/**
	 * 波长，单位为 dp。
	 *
	 * 设置为 `0` 时会退化为普通直线 Slider。
	 *
	 * @default 16
	 */
	waveLength?: ObservableNumber
	/**
	 * 波浪高度，单位为 dp。
	 *
	 * 设置为 `0` 时会退化为普通直线 Slider。
	 * 可传 `ObservableState<number>`，用 Reanimated 自行实现暂停展平、拖动展平等动画。
	 *
	 * @default 16
	 */
	waveHeight?: ObservableNumber
	/**
	 * 波浪移动速度，单位为 dp/秒。
	 *
	 * 设置为 `0` 时波浪停止移动，适合播放器暂停态。
	 * 可传 `ObservableState<number>`，用 Reanimated 在播放/暂停之间自行过渡。
	 *
	 * @default 15
	 */
	waveVelocity?: ObservableNumber
	/**
	 * 波浪移动方向。
	 *
	 * @default 'head'
	 */
	waveDirection?: WavySliderWaveDirection
	/**
	 * active wave 的线条厚度，单位为 dp。
	 *
	 * @default 4
	 */
	waveThickness?: ObservableNumber
	/**
	 * inactive track 与 buffered track 的线条厚度，单位为 dp。
	 *
	 * @default 4
	 */
	trackThickness?: ObservableNumber
	/**
	 * 是否让波浪高度从轨道起点到手柄位置逐渐增加。
	 *
	 * @default false
	 */
	incremental?: boolean
	/**
	 * 拖动过程中的高频回调。
	 *
	 * 必须是 worklet 函数
	 */
	onValueChange?: (value: number) => void
	/**
	 * 用户完成拖动/点击 seek 后触发的回调。
	 *
	 * 必须是 worklet 函数
	 */
	onValueChangeFinished?: (value: number) => void
	/**
	 * 原生拖动状态变化回调。
	 *
	 * 该回调在 Compose 的 `interactionSource.collectIsDraggedAsState()` 变化时触发。
	 * 必须是 worklet 函数，适合把拖动状态写入 Reanimated SharedValue，再由 JS/UI runtime 自行驱动
	 * `waveHeight`、`waveThickness` 和 `trackThickness` 等 ObservableState 参数。
	 */
	onDragStateChange?: (isDragged: boolean) => void
}
