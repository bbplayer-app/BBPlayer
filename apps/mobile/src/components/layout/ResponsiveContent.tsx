import type { PropsWithChildren } from 'react'
import { useContext, useState } from 'react'
import type { ViewProps } from 'react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { ResponsiveLayoutContext } from '@/hooks/ui/useResponsiveLayout'

export default function ResponsiveContent({
	children,
	style,
	reservedWidth = 0,
	...props
}: PropsWithChildren<
	ViewProps & {
		/** 首次测量前，从窗口宽度中预先扣除的宽度（安全区、侧边导航栏）。 */
		reservedWidth?: number
	}
>) {
	const window = useWindowDimensions()
	const parent = useContext(ResponsiveLayoutContext)

	const [size, setSize] = useState<{ width: number; height: number } | null>(
		null,
	)

	// 首帧还没有测量结果：优先沿用外层内容区的尺寸，否则用窗口尺寸扣掉预留宽度，
	// 避免首帧按整个窗口宽度判断断点、测量后又跳回另一种布局。
	const fallback = parent ?? {
		width: window.width - reservedWidth,
		height: window.height,
	}

	return (
		<View
			{...props}
			style={[styles.content, style]}
			onLayout={(event) => {
				const { width, height } = event.nativeEvent.layout
				setSize((previous) =>
					previous?.width === width && previous.height === height
						? previous
						: { width, height },
				)
				props.onLayout?.(event)
			}}
		>
			<ResponsiveLayoutContext value={size ?? fallback}>
				{children}
			</ResponsiveLayoutContext>
		</View>
	)
}

const styles = StyleSheet.create({
	content: { flex: 1, minHeight: 0, width: '100%', alignSelf: 'center' },
})
