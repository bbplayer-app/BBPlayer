import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

import type {
	AppUpdateDownloadOptions,
	AppUpdateInstallResult,
} from './BBPlayerNative.types'

declare class BBPlayerNativeModule extends NativeModule {
	getSupportedAbisAsync(): Promise<string[]>
	canRequestPackageInstallsAsync(): Promise<boolean>
	openPackageInstallerSettingsAsync(): Promise<void>
	downloadAndInstallApkAsync(
		options: AppUpdateDownloadOptions,
	): Promise<AppUpdateInstallResult>
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
