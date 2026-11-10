import { requireNativeView, requireOptionalNativeModule } from 'expo'
import type { NativeModule } from 'expo'
import { createElement } from 'react'
import { Platform, processColor, View, type ViewProps } from 'react-native'

declare class BBPlayerTvFocusModule extends NativeModule {
	setFocusRingColor(color: number): void
}

const tvFocusModule =
	Platform.OS === 'android'
		? requireOptionalNativeModule<BBPlayerTvFocusModule>('BBPlayerTvFocus')
		: null

/**
 * 设置遥控器 / 键盘导航时焦点框的颜色。
 *
 * 焦点框只在非触摸模式（用方向键操作）时出现，触摸操作看不到。
 */
export const setFocusRingColor = (color: string) => {
	const processed = processColor(color)
	if (typeof processed !== 'number') return
	tvFocusModule?.setFocusRingColor(processed)
}

export interface TvFocusScopeProps extends ViewProps {
	/**
	 * 是否生效。关闭后表现为普通 View。默认 true。
	 */
	active?: boolean
	/**
	 * 出现时把焦点移到第一个可聚焦的子元素。默认 true。
	 */
	autoFocus?: boolean
	/**
	 * 方向键不能把焦点移出容器。默认 true。
	 */
	trapFocus?: boolean
	/**
	 * 消失时把焦点还给打开它之前的元素。默认 true。
	 */
	restoreFocus?: boolean
}

const NativeTvFocusScope = tvFocusModule
	? requireNativeView<TvFocusScopeProps>('BBPlayerTvFocus', 'TvFocusScopeView')
	: null

/**
 * 弹窗、底部面板、菜单等浮层的焦点范围：用遥控器操作时，焦点会自动进入、
 * 不会跑到后面的页面上，关闭后回到原来的位置。触摸操作下没有任何效果。
 */
export function TvFocusScope(props: TvFocusScopeProps) {
	if (!NativeTvFocusScope) {
		return createElement(View, props)
	}
	return createElement(NativeTvFocusScope, props)
}
