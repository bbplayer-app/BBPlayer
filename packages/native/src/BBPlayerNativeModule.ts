import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

import type {
	AppUpdateDownloadOptions,
	AppUpdateInstallResult,
	UnzipOptions,
	UnzipResult,
} from './BBPlayerNative.types'

declare class BBPlayerNativeModule extends NativeModule {
	/**
	 * 当前 APK 签名证书的 SHA-256 指纹（小写十六进制），模块初始化时计算一次。
	 * 取不到时为空字符串。
	 */
	readonly apkSigningCertificateSha256: string
	getSupportedAbisAsync(): Promise<string[]>
	canRequestPackageInstallsAsync(): Promise<boolean>
	openPackageInstallerSettingsAsync(): Promise<void>
	downloadAndInstallApkAsync(
		options: AppUpdateDownloadOptions,
	): Promise<AppUpdateInstallResult>
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

/**
 * 当前 APK 签名证书的 SHA-256 指纹（小写十六进制）。
 *
 * 仅用于判断构建来源，不构成安全保证：仓库开源，fork 可以直接改掉这段逻辑。
 * 仅 Android 可用；iOS、Expo Go 或原生模块不可用时返回 null。
 */
export const getApkSigningCertificateSha256 = (): string | null => {
	if (Platform.OS !== 'android') return null
	try {
		const value = getNativeModule().apkSigningCertificateSha256
		return value ? value.toLowerCase() : null
	} catch {
		// 原生模块不可用（例如 Expo Go）时无法校验签名
		return null
	}
}

export const openPackageInstallerSettingsAsync = () =>
	getNativeModule().openPackageInstallerSettingsAsync()

export const downloadAndInstallApkAsync = (options: AppUpdateDownloadOptions) =>
	getNativeModule().downloadAndInstallApkAsync(options)

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
