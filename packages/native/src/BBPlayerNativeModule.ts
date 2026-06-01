import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

import type {
	AppUpdateDownloadOptions,
	AppUpdateInstallResult,
	SvgaToGifOptions,
	SvgaToGifResult,
	UnzipOptions,
	UnzipResult,
} from './BBPlayerNative.types'

declare class BBPlayerNativeModule extends NativeModule {
	getSupportedAbisAsync(): Promise<string[]>
	canRequestPackageInstallsAsync(): Promise<boolean>
	openPackageInstallerSettingsAsync(): Promise<void>
	downloadAndInstallApkAsync(
		options: AppUpdateDownloadOptions,
	): Promise<AppUpdateInstallResult>
	convertSvgaBinToGifAsync(options: SvgaToGifOptions): Promise<SvgaToGifResult>
	unzipAsync(options: UnzipOptions): Promise<UnzipResult>
}

let nativeModule: BBPlayerNativeModule | null = null

const getNativeModule = () => {
	if (Platform.OS !== 'android') {
		throw new Error(
			'BBPlayerNative app updates are only implemented on Android',
		)
	}
	nativeModule ??= requireNativeModule<BBPlayerNativeModule>('BBPlayerNative')
	return nativeModule
}

export const canRequestPackageInstallsAsync = () =>
	getNativeModule().canRequestPackageInstallsAsync()

export const getSupportedAbisAsync = () =>
	getNativeModule().getSupportedAbisAsync()

export const openPackageInstallerSettingsAsync = () =>
	getNativeModule().openPackageInstallerSettingsAsync()

export const downloadAndInstallApkAsync = (options: AppUpdateDownloadOptions) =>
	getNativeModule().downloadAndInstallApkAsync(options)

export const convertSvgaBinToGifAsync = (options: SvgaToGifOptions) =>
	getNativeModule().convertSvgaBinToGifAsync(options)

export const unzipAsync = (options: UnzipOptions) =>
	getNativeModule().unzipAsync(options)
