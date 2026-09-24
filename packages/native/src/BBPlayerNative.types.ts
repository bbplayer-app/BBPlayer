export interface AppUpdateDownloadOptions {
	url: string
	fileName?: string
	title?: string
	description?: string
}

export interface AppUpdateInstallResult {
	downloadId: number
	uri: string
}

export interface UnzipOptions {
	inputUri: string
	outputUri: string
}

export interface UnzipResult {
	uri: string
	fileCount: number
}

export interface StorageUsage {
	/** 运行数据缓存：`cacheDir` 中除音乐缓存外的部分（图片、临时文件等）。 */
	runtimeCacheBytes: number
	/** 音乐缓存：Media3 在线播放的 LRU 缓存。 */
	musicCacheBytes: number
	/** 音乐缓存的容量上限（字节）。 */
	musicCacheMaxBytes: number
	/** 下载：离线音乐与已下载封面。 */
	downloadBytes: number
	/** 其他应用数据：数据库、设置、歌词等持久化文件。 */
	otherBytes: number
	/** 应用包大小：基础安装包与全部 split APK 之和。 */
	packageBytes: number
}
