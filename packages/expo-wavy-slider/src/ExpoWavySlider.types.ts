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
	waveLength?: number
	/**
	 * 波浪高度，单位为 dp。
	 *
	 * 设置为 `0` 时会退化为普通直线 Slider。
	 *
	 * @default 16
	 */
	waveHeight?: number
	/**
	 * 波浪移动速度，单位为 dp/秒。
	 *
	 * 设置为 `0` 时波浪停止移动，适合播放器暂停态。
	 *
	 * @default 15
	 */
	waveVelocity?: number
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
	waveThickness?: number
	/**
	 * inactive track 与 buffered track 的线条厚度，单位为 dp。
	 *
	 * @default 4
	 */
	trackThickness?: number
	/**
	 * 是否让波浪高度从轨道起点到手柄位置逐渐增加。
	 *
	 * @default false
	 */
	incremental?: boolean
	/**
	 * 用户拖动时是否将波浪高度动画到 `flattenedWaveHeight`。
	 *
	 * 常用于拖动时把波浪展平成普通轨道，减少 seek 过程中的视觉干扰。
	 *
	 * @default false
	 */
	flattenOnDrag?: boolean
	/**
	 * `flattenOnDrag` 启用时，拖动期间的目标波浪高度，单位为 dp。
	 *
	 * 传 `0` 时拖动期间 active 部分会变成直线。
	 *
	 * @default 0
	 */
	flattenedWaveHeight?: number
	/**
	 * 拖动开始后，波浪高度动画到 `flattenedWaveHeight` 的时长，单位为毫秒。
	 *
	 * @default 100
	 */
	flattenAnimationDurationMs?: number
	/**
	 * 拖动结束后，波浪高度从 `flattenedWaveHeight` 恢复到 `waveHeight` 的动画时长，单位为毫秒。
	 *
	 * 该属性只控制波浪高度恢复，不控制轨道粗细恢复；轨道粗细恢复请使用 `trackRestoreAnimationDurationMs`。
	 *
	 * @default 300
	 */
	restoreWaveHeightAnimationDurationMs?: number
	/**
	 * 用户拖动时是否将轨道粗细动画到 `draggedTrackThickness`。
	 *
	 * @default false
	 */
	expandTrackOnDrag?: boolean
	/**
	 * `expandTrackOnDrag` 启用时，拖动期间 active、inactive 与 buffered 轨道的目标厚度，单位为 dp。
	 *
	 * @default 12
	 */
	draggedTrackThickness?: number
	/**
	 * 拖动开始后，轨道粗细动画到 `draggedTrackThickness` 的时长，单位为毫秒。
	 *
	 * @default 200
	 */
	trackExpansionAnimationDurationMs?: number
	/**
	 * 拖动结束后，轨道粗细恢复到 `waveThickness` / `trackThickness` 的时长，单位为毫秒。
	 *
	 * @default 200
	 */
	trackRestoreAnimationDurationMs?: number
	/**
	 * 组件首次进入组合时，波浪从平直到完整波形的展开动画时长，单位为毫秒。
	 *
	 * 上游库默认值较长；播放器场景通常可以传 `0`，避免暂停态仍出现波浪展开动画。
	 *
	 * @default 6000
	 */
	waveAppearanceAnimationDurationMs?: number
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
}
