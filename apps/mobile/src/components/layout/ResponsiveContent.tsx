import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import type { ViewProps } from 'react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { ResponsiveLayoutContext } from '@/hooks/ui/useResponsiveLayout'

export default function ResponsiveContent({
	children,
	style,
	...props
}: PropsWithChildren<ViewProps>) {
	const window = useWindowDimensions()
	const [size, setSize] = useState<{ width: number; height: number } | null>(
		null,
	)
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
			<ResponsiveLayoutContext
				value={
					size ?? {
						width: window.width,
						height: window.height,
					}
				}
			>
				{children}
			</ResponsiveLayoutContext>
		</View>
	)
}

const styles = StyleSheet.create({
	content: { flex: 1, minHeight: 0, width: '100%', alignSelf: 'center' },
})
