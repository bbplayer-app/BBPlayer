import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

import type {
	AppUpdateDownloadOptions,
	AppUpdateInstallResult,
	SvgaToGifOptions,
	SvgaToGifResult,
	SvgaToSpriteSheetOptions,
	SvgaToSpriteSheetResult,
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
	convertSvgaBinToSpriteSheetAsync(
		options: SvgaToSpriteSheetOptions,
	): Promise<SvgaToSpriteSheetResult>
	unzipAsync(options: UnzipOptions): Promise<UnzipResult>
	exportBackupToDownloads(
		sourceUri: string,
		fileName: string,
		mimeType: string,
	): string | null
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

export const convertSvgaBinToSpriteSheetAsync = (
	options: SvgaToSpriteSheetOptions,
) => getNativeModule().convertSvgaBinToSpriteSheetAsync(options)

export const unzipAsync = (options: UnzipOptions) =>
	getNativeModule().unzipAsync(options)

/**
 * 将文件写入 Downloads/bbplayer-backup 目录。
 *
 * Android Q+ 走 MediaStore API，旧版走文件直写。
 * 返回写入后的 content URI，失败返回 null。
 */
export const exportBackupToDownloads = (
	sourceUri: string,
	fileName: string,
	mimeType: string,
) => getNativeModule().exportBackupToDownloads(sourceUri, fileName, mimeType)
