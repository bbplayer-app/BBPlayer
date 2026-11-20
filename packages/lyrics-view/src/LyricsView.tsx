import { requireNativeView } from 'expo'
import { createElement } from 'react'
import { Platform, type ColorValue, type ViewProps } from 'react-native'

/** 目前只有 Android 有原生实现 */
export const isNativeLyricsViewSupported = Platform.OS === 'android'

export interface NativeLyricSpan {
	text: string
	/** 毫秒 */
	startTime: number
	/** 毫秒 */
	endTime: number
}

export interface NativeLyricLine {
	/** 毫秒 */
	startTime: number
	/** 毫秒 */
	endTime: number
	content: string
	/** 显示在主歌词下方的翻译或罗马音 */
	subText?: string
	/** 为空时按普通歌词显示 */
	spans: NativeLyricSpan[]
}

export interface NativeLyricsViewProps extends ViewProps {
	lines: NativeLyricLine[]
	/** 单位秒，显示时间 = 播放进度 - offset */
	offset?: number
	/** 页面不可见时设为 true，停止逐帧刷新 */
	paused?: boolean
	/** 歌词颜色，明暗层次由组件内部按 Apple Music 的透明度处理 */
	color: ColorValue
	/** `plus` 为 Apple Music 的叠加混合，只适合深色背景；浅色背景用 `normal` */
	blendMode?: 'plus' | 'normal'
	/** 主歌词字号，不传时按视图宽度的 8% 自动计算 */
	fontSize?: number
	/** 顶部渐隐高度（dp） */
	fadeTop?: number
	/** 底部渐隐高度（dp） */
	fadeBottom?: number
	/** 底部完全不可见区域的高度（dp），给覆盖在上面的控件让位 */
	bottomInset?: number
	onLinePress?: (event: { nativeEvent: { index: number } }) => void
	onBackgroundPress?: () => void
}

const NativeView = isNativeLyricsViewSupported
	? requireNativeView<NativeLyricsViewProps>('BBPlayerLyricsView', 'LyricsView')
	: null

export function NativeLyricsView(props: NativeLyricsViewProps) {
	if (!NativeView) return null

	return createElement(NativeView, props)
}
