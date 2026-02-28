import { requireNativeModule, NativeModule } from 'expo-modules-core'

export enum PlaybackState {
	IDLE = 1,
	BUFFERING = 2,
	READY = 3,
	ENDED = 4,
}

export enum RepeatMode {
	OFF = 0,
	TRACK = 1,
	QUEUE = 2,
}

export enum TransitionReason {
	REPEAT = 0,
	AUTO = 1,
	SEEK = 2,
	PLAYLIST_CHANGED = 3,
}

export interface Track {
	id: string
	url: string
	title?: string
	artist?: string
	artwork?: string
	duration?: number
}

export interface AndroidPlaybackErrorEvent {
	platform: 'android'
	errorCode: number
	errorCodeName: string | null
	timestamp: string
	message: string | null
	stackTrace: string
	rootCauseClass: string
	rootCauseMessage: string
}

export interface IosPlaybackErrorEvent {
	platform: 'ios'
	error: string
}

export type PlaybackErrorEvent =
	| AndroidPlaybackErrorEvent
	| IosPlaybackErrorEvent

export interface OrpheusEvents {
	onPlaybackStateChanged(event: { state: PlaybackState }): void
	onTrackStarted(event: { trackId: string; reason: number }): void
	onTrackFinished(event: {
		trackId: string
		finalPosition: number
		duration: number
	}): void
	onHeadlessEvent(event: OrpheusHeadlessEvent): void
	onPlayerError(event: PlaybackErrorEvent): void
	onPositionUpdate(event: {
		position: number
		duration: number
		buffered: number
	}): void
	onIsPlayingChanged(event: { status: boolean }): void
	onDownloadUpdated(event: DownloadTask): void
	onCoverDownloadProgress(event: {
		current: number
		total: number
		trackId: string
		status: 'success' | 'failed'
	}): void
	onPlaybackSpeedChanged(event: { speed: number }): void
	onExportProgress(event: {
		progress?: number
		currentId: string
		index?: number
		total?: number
		status: 'success' | 'error'
		message?: string
	}): void
	// oxlint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: (...args: any[]) => void
}

export interface OrpheusHeadlessTrackStartedEvent {
	eventName: 'onTrackStarted'
	trackId: string
	reason: number
}

export interface OrpheusHeadlessTrackFinishedEvent {
	eventName: 'onTrackFinished'
	trackId: string
	finalPosition: number
	duration: number
}

export interface OrpheusHeadlessTrackPausedEvent {
	eventName: 'onTrackPaused'
}

export interface OrpheusHeadlessTrackResumedEvent {
	eventName: 'onTrackResumed'
}

export type OrpheusHeadlessEvent =
	| OrpheusHeadlessTrackStartedEvent
	| OrpheusHeadlessTrackFinishedEvent
	| OrpheusHeadlessTrackPausedEvent
	| OrpheusHeadlessTrackResumedEvent

declare class OrpheusModule extends NativeModule<OrpheusEvents> {
	restorePlaybackPositionEnabled: boolean
	loudnessNormalizationEnabled: boolean
	autoplayOnStartEnabled: boolean
	isDesktopLyricsShown: boolean
	isDesktopLyricsLocked: boolean

	/**
	 * 获取当前进度（秒）
	 */
	getPosition(): Promise<number>

	/**
	 * 获取总时长（秒）
	 */
	getDuration(): Promise<number>

	/**
	 * 获取缓冲进度（秒）
	 */
	getBuffered(): Promise<number>

	/**
	 * 获取是否正在播放
	 */
	getIsPlaying(): Promise<boolean>

	/**
	 * 获取当前播放索引
	 */
	getCurrentIndex(): Promise<number>

	/**
	 * 获取当前播放的 Track 对象
	 */
	getCurrentTrack(): Promise<Track | null>

	/**
	 * 获取随机模式状态
	 */
	getShuffleMode(): Promise<boolean>

	/**
	 * 获取指定索引的 Track
	 */
	getIndexTrack(index: number): Promise<Track | null>

	getRepeatMode(): Promise<RepeatMode>

	setBilibiliCookie(cookie: string): void

	play(): Promise<void>

	pause(): Promise<void>

	clear(): Promise<void>

	skipTo(index: number): Promise<void>

	skipToNext(): Promise<void>

	skipToPrevious(): Promise<void>

	/**
	 * 跳转进度
	 * @param seconds 秒数
	 */
	seekTo(seconds: number): Promise<void>

	setRepeatMode(mode: RepeatMode): Promise<void>

	setShuffleMode(enabled: boolean): Promise<void>

	getQueue(): Promise<Track[]>

	/**
	 * 添加到队列末尾，且不去重。
	 * @param tracks
	 * @param startFromId 可选，添加后立即播放该 ID 的曲目
	 * @param clearQueue 可选，是否清空当前队列
	 */
	addToEnd(
		tracks: Track[],
		startFromId?: string,
		clearQueue?: boolean,
	): Promise<void>

	/**
	 * 播放下一首
	 * @param track
	 */
	playNext(track: Track): Promise<void>

	removeTrack(index: number): Promise<void>

	/**
	 * 设置睡眠定时器
	 * @param durationMs 单位毫秒
	 */
	setSleepTimer(durationMs: number): Promise<void>

	/**
	 * 获取睡眠定时器结束时间
	 * @returns 单位毫秒，如果没有设置则返回 null
	 */
	getSleepTimerEndTime(): Promise<number | null>

	cancelSleepTimer(): Promise<void>

	/**
	 * 下载单首歌曲
	 */
	downloadTrack(track: Track): Promise<void>

	/**
	 * 移除下载任务
	 */
	removeDownload(id: string): Promise<void>

	/**
	 * 批量移除下载任务
	 */
	removeDownloads(ids: string[]): Promise<void>

	/**
	 * 批量下载歌曲
	 */
	multiDownload(tracks: Track[]): Promise<void>

	/**
	 * 移除所有下载任务(包括已完成的及源文件)
	 */
	removeAllDownloads(): Promise<void>

	/**
	 * 获取所有下载任务
	 */
	getDownloads(): Promise<DownloadTask[]>

	/**
	 * 批量返回指定 ID 的下载状态
	 */
	getDownloadStatusByIds(ids: string[]): Promise<Record<string, DownloadState>>

	/**
	 * 清除未完成的下载任务
	 */
	clearUncompletedDownloadTasks(): Promise<void>

	/**
	 * 获取所有未完成的下载任务
	 */
	getUncompletedDownloadTasks(): Promise<DownloadTask[]>

	/**
	 * 下载缺失的封面图片（本地有歌曲但没有封面的）
	 * @returns 启动下载的封面数量
	 */
	downloadMissingCovers(): Promise<number>

	/**
	 * 获取已下载的封面 URI
	 * @returns file:// URI，如果不存在返回 null
	 */
	getDownloadedCoverUri(trackId: string): string | null

	/**
	 * 批量导出已下载的曲目到指定目录 (仅限 Android SAF URI)
	 * @param ids 曲目 ID 列表
	 * @param destinationUri 目标目录的 SAF URI (通过 selectDirectory 获取)
	 * @param filenamePattern 文件名模板，支持以下变量：
	 *   - `{id}`     — 曲目唯一 ID
	 *   - `{name}`   — 曲目标题
	 *   - `{artist}` — 艺术家名称
	 *   - `{bvid}`   — B 站 BV 号（非 B 站曲目为空字符串）
	 *   - `{cid}`    — B 站 CID（非 B 站曲目为空字符串，可选使用）
	 *   不提供时默认使用 `{name}`
	 * @param embedLyrics 是否将歌词嵌入到 m4a 文件。
	 *   **注意**：仅对用户在播放器歌词页面加载过歌词的曲目有效。
	 *   加载过的歌词会缓存到本地；未加载过的曲目将不含内嵌歌词。
	 * @param convertToLrc 是否将 SPL 歌词转换为标准 LRC。
	 *   SPL 是 LRC 的超集，支持逐字时间戳（`<mm:ss.ms>`），
	 *   但仅椒盐音乐等少数播放器能识别；开启后将移除逐字时间戳，
	 *   输出兼容所有播放器的标准 LRC。仅在 `embedLyrics=true` 时生效。
	 * @param cropCoverArt 是否裁剪封面为正方形（以短边为基准）。默认 false 保持原始封面比例。
	 *
	 * @example
	 * // 生成 "米津玄師 - Lemon.m4a"
	 * exportDownloads(ids, uri, '{artist} - {name}', true, false)
	 * // 生成 "BV1xx411c7mD_123456789.m4a"
	 * exportDownloads(ids, uri, '{bvid}_{cid}', false, false)
	 */
	exportDownloads(
		ids: string[],
		destinationUri: string,
		filenamePattern: string,
		embedLyrics: boolean,
		convertToLrc: boolean,
		cropCoverArt: boolean,
	): Promise<void>

	/**
	 * 调起系统目录选择器并返回目录的 URI (仅限 Android)
	 * @returns 目录的 URI 字符串，如果取消则返回 null
	 */
	selectDirectory(): Promise<string | null>

	checkOverlayPermission(): Promise<boolean>
	requestOverlayPermission(): Promise<void>
	showDesktopLyrics(): Promise<void>
	hideDesktopLyrics(): Promise<void>
	setDesktopLyrics(lyricsJson: string): Promise<void>

	setPlaybackSpeed(speed: number): Promise<void>
	getPlaybackSpeed(): Promise<number>
	debugTriggerError(): Promise<void>

	/**
	 * 同步更新提供的 Float32Array 为最新的频谱频率数据。
	 * 该数组应该在 JS 端创建一次并在动画循环中重复使用，以避免内存分配开销。
	 *
	 * 初始化长度建议为 SPECTRUM_SIZE
	 *
	 * @param destination 用于接收数据的 Float32Array
	 */
	updateSpectrumData(destination: Float32Array): void

	/**
	 * 检查传入的 URI 列表中，哪些已经被完整缓存在本地 LRU Cache 中。
	 * @param uris 包含完整播放参数的 URI 列表 (例如 `orpheus://bilibili?...`)
	 * @returns 返回已完整缓存的 URI 列表
	 */
	getLruCachedUris(uris: string[]): string[]
}

/**
 * 频谱数据的有效长度。
 * 建议使用此常量来初始化 Float32Array。
 */
export const SPECTRUM_SIZE = 512

export enum DownloadState {
	QUEUED = 0,
	STOPPED = 1,
	DOWNLOADING = 2,
	COMPLETED = 3,
	FAILED = 4,
	REMOVING = 5,
	RESTARTING = 7,
}

export interface DownloadTask {
	id: string
	state: DownloadState
	percentDownloaded: number
	bytesDownloaded: number
	contentLength: number
	track?: Track
}

export const Orpheus = requireNativeModule<OrpheusModule>('Orpheus')
