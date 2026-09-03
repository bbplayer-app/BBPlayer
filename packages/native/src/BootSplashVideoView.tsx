import { requireNativeView } from 'expo'
import { createElement, forwardRef } from 'react'
import { Platform, type NativeMethods, type ViewProps } from 'react-native'

const NativeBootSplashVideoView =
	Platform.OS === 'android'
		? requireNativeView<BootSplashVideoViewProps>(
				'BBPlayerBootSplashVideo',
				'BootSplashVideoView',
			)
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

export interface BootSplashVideoViewRef extends NativeMethods {
	replay(): Promise<void>
}

export const BootSplashVideoView = forwardRef<
	BootSplashVideoViewRef,
	BootSplashVideoViewProps
>(function BootSplashVideoView(props, ref) {
	if (Platform.OS !== 'android' || !NativeBootSplashVideoView) {
		throw new Error(
			'[bbplayer/native] BootSplashVideoView is only implemented on Android.',
		)
	}
	return createElement(NativeBootSplashVideoView, {
		...props,
		// @ts-expect-error -- 不想管
		ref,
	})
})
