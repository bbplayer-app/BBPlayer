import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

import type {
	CastOptions,
	CastSession,
	DlnaDevice,
	DlnaPlaybackStatus,
} from './BBPlayerDlna.types'

declare class BBPlayerDlnaNativeModule extends NativeModule {
	discoverAsync(timeoutMs: number): Promise<DlnaDevice[]>
	castAsync(options: CastOptions): Promise<CastSession>
	stopCastAsync(): Promise<void>
	getStatusAsync(): Promise<DlnaPlaybackStatus | null>
	pauseCastAsync(): Promise<void>
	resumeCastAsync(): Promise<void>
	seekCastAsync(seconds: number): Promise<void>
	isCasting(): boolean
}

let nativeModule: BBPlayerDlnaNativeModule | null = null

const getNativeModule = () => {
	if (Platform.OS !== 'android') {
		throw new Error('DLNA 投屏目前只支持 Android')
	}
	nativeModule ??= requireNativeModule<BBPlayerDlnaNativeModule>('BBPlayerDlna')
	return nativeModule
}

export const discoverDlnaDevices = (timeoutMs = 3000) =>
	getNativeModule().discoverAsync(timeoutMs)

export const castToDlna = (options: CastOptions) =>
	getNativeModule().castAsync({
		...options,
		headersJson:
			options.headersJson ??
			(options.headers ? JSON.stringify(options.headers) : undefined),
	})

export const stopDlnaCast = () => getNativeModule().stopCastAsync()

export const getDlnaStatus = () => getNativeModule().getStatusAsync()

export const pauseDlnaCast = () => getNativeModule().pauseCastAsync()

export const resumeDlnaCast = () => getNativeModule().resumeCastAsync()

export const seekDlnaCast = (seconds: number) =>
	getNativeModule().seekCastAsync(seconds)

export const isDlnaCasting = () => {
	if (Platform.OS !== 'android') return false
	return getNativeModule().isCasting()
}
