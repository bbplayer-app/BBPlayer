import { requireNativeView } from 'expo'
import { createElement, forwardRef, type RefAttributes } from 'react'
import { Platform, type ViewProps } from 'react-native'

/** Only Android has the native view; other platforms show the poster instead. */
export const isBootSplashVideoSupported = Platform.OS === 'android'

const NativeBootSplashVideoView = isBootSplashVideoSupported
	? requireNativeView<
			BootSplashVideoViewProps & RefAttributes<BootSplashVideoViewRef>
		>('BBPlayerBootSplashVideo', 'BootSplashVideoView')
	: null

export interface BootSplashVideoViewProps extends ViewProps {
	sourceUri: string | null
	autoPlay?: boolean
	loop?: boolean
	muted?: boolean
	contentFit?: 'contain' | 'cover'
	onPlaybackEnd?: () => void
	onPlaybackError?: (event: {
		nativeEvent: { extra?: number; message?: string; what?: number }
	}) => void
}

export interface BootSplashVideoViewRef {
	replay(): Promise<void>
}

export const BootSplashVideoView = forwardRef<
	BootSplashVideoViewRef,
	BootSplashVideoViewProps
>(function BootSplashVideoView(props, ref) {
	if (!NativeBootSplashVideoView) return null
	return createElement(NativeBootSplashVideoView, {
		...props,
		ref,
	})
})
