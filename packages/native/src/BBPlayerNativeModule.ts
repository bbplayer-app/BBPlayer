import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

import type {
	AppUpdateDownloadOptions,
	AppUpdateInstallResult,
	StorageEntry,
	StorageUsage,
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
	/**
	 * Android 应用私有目录中的各项占用，以及安装包大小（字节）。
	 */
	getStorageUsageAsync(): Promise<StorageUsage>
	/**
	 * 清理运行数据缓存：删除 `cacheDir` 中除 Media3 LRU 缓存外的全部内容。
	 *
	 * 不会删除离线下载；Media3 LRU 缓存由 `@bbplayer/orpheus` 单独清理。
	 */
	clearCacheAsync(): Promise<void>
	/**
	 * 只读列出应用私有目录（`dataDir`）下 `path` 的内容。
	 *
	 * `path` 为相对 `dataDir` 的路径，空字符串表示根目录。
	 */
	listStorageDirectoryAsync(path: string): Promise<StorageEntry[]>
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
	getMillisSinceProcessStart(): number
	installNativeTelemetry(enabled: boolean): string | null
	setNativeTracesSampleRate(rate: number): void
	getSentryInstallationId(): string | null
	setNativeTelemetryEnabled(enabled: boolean): void
	debugTriggerNativeError(): void
}

let nativeModule: BBPlayerNativeModule | null = null

const getNativeModule = () => {
	if (Platform.OS !== 'android') {
		throw new Error('BBPlayerNative is only implemented on Android')
	}

	nativeModule ??= requireNativeModule<BBPlayerNativeModule>('BBPlayerNative')

	return nativeModule
}

export const canRequestPackageInstallsAsync = () =>
	getNativeModule().canRequestPackageInstallsAsync()

export const getSupportedAbisAsync = () =>
	getNativeModule().getSupportedAbisAsync()

/**
 * Android 应用私有目录中的各项占用，以及安装包大小（字节）。
 *
 * Media3 的下载、封面与在线播放缓存目录由 `@bbplayer/orpheus` 写入，这里只做只读统计。
 */
export const getStorageUsageAsync = () =>
	getNativeModule().getStorageUsageAsync()

/**
 * 清理运行数据缓存：删除 `cacheDir` 中除 Media3 LRU 缓存外的全部内容。
 *
 * 不会删除离线下载；Media3 LRU 缓存由 `@bbplayer/orpheus` 单独清理。
 */
export const clearCacheAsync = async () => {
	// iOS 的图片缓存由 expo-image 清理，没有额外的运行数据缓存。
	if (Platform.OS !== 'android') return
	await getNativeModule().clearCacheAsync()
}

/**
 * 只读列出应用私有目录（`dataDir`）下 `path` 的内容。
 *
 * `path` 为相对 `dataDir` 的路径，空字符串表示根目录。
 */
export const listStorageDirectoryAsync = (path: string) =>
	getNativeModule().listStorageDirectoryAsync(path)

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

/**
 * 距进程启动的毫秒数（`SystemClock.uptimeMillis() - Process.getStartUptimeMillis()`）。
 *
 * 与 expo-app-metrics 的启动指标使用同一时钟，可以直接和 `coldLaunchTime` 等指标换算。
 */
export const getMillisSinceProcessStart = () =>
	getNativeModule().getMillisSinceProcessStart()

/**
 * 在原生 Sentry SDK 上挂接脱敏、限流与数据采集开关，并按开关开启原生日志。
 *
 * 必须在 JS 的 `Sentry.init` 完成原生初始化（`onReady`）之后调用。
 * 返回 Sentry 的匿名安装 ID；原生 SDK 未初始化或不可用时返回 null。
 */
export const installNativeTelemetry = (enabled: boolean): string | null => {
	if (Platform.OS !== 'android') return null

	try {
		return getNativeModule().installNativeTelemetry(enabled)
	} catch {
		return null
	}
}

/**
 * 开启原生侧 tracing，采样率应与 JS 的 `tracesSampleRate` 一致。
 *
 * 单独成一个函数而不是加进 `installNativeTelemetry` 的参数：热更新的 JS 可能跑在没有这个函数的旧原生包上，
 * 这时只是原生请求没有 span，不影响脱敏与限流回调的挂接。
 */
export const setNativeTracesSampleRate = (rate: number) => {
	if (Platform.OS !== 'android') return

	try {
		getNativeModule().setNativeTracesSampleRate(rate)
	} catch {}
}

/** 同步数据采集开关：关闭后原生侧立即停止上报事件与日志。 */
export const setNativeTelemetryEnabled = (enabled: boolean) => {
	if (Platform.OS !== 'android') return

	try {
		getNativeModule().setNativeTelemetryEnabled(enabled)
	} catch {
		// 原生模块不可用（例如 Expo Go）时没有原生 SDK 需要同步
	}
}

/** 测试页使用：输出几条原生日志，并由原生 Sentry SDK 上报一个异常。 */
export const debugTriggerNativeError = () =>
	getNativeModule().debugTriggerNativeError()

/**
 * Sentry 的匿名安装 ID，与原生 SDK 使用的是同一个，可以在 `Sentry.init` 之前同步取得。
 * 不可用时返回 null。
 */
export const getSentryInstallationId = (): string | null => {
	if (Platform.OS !== 'android') return null

	try {
		return getNativeModule().getSentryInstallationId()
	} catch {
		return null
	}
}
