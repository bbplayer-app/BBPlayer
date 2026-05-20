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

export interface LyricSpan {
	text: string
	startTime: number // ms
	endTime: number // ms
	duration: number // ms
}

export interface LyricLine {
	timestamp: number // seconds
	endTime?: number // seconds
	text: string
	translation?: string
	romaji?: string
	spans?: LyricSpan[]
}

export interface LyricsData {
	lyrics: LyricLine[]
	offset: number
}

export type LyricConsumer = 'desktop' | 'statusBar' | 'car'

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

export type OrpheusEvents = {
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
	onStatusBarLyricsStatusChanged(): void
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

export interface OrpheusHeadlessRequestClearLyricsEvent {
	eventName: 'onRequestClearLyrics'
	trackId: string
}

export type OrpheusHeadlessEvent =
	| OrpheusHeadlessTrackStartedEvent
	| OrpheusHeadlessTrackFinishedEvent
	| OrpheusHeadlessTrackPausedEvent
	| OrpheusHeadlessTrackResumedEvent
	| OrpheusHeadlessRequestClearLyricsEvent

/** 内部使用的原生接口定义 */
declare class NativeOrpheusModule extends NativeModule<OrpheusEvents> {
	/** 原生服务启动时是否恢复上次保存的队列索引和播放位置。 */
	restorePlaybackPositionEnabled: boolean
	/** Android 创建播放器时是否应用已保存的响度标准化增益。 */
	loudnessNormalizationEnabled: boolean
	/** Android 服务恢复状态后是否自动开始播放。 */
	autoplayOnStartEnabled: boolean
	/** 原生存储中桌面悬浮歌词窗口当前是否标记为显示。 */
	isDesktopLyricsShown: boolean
	/** 桌面悬浮歌词窗口是否锁定为不可拖动。 */
	isDesktopLyricsLocked: boolean
	/** 是否向当前配置的 Android 状态栏歌词后端发送歌词。 */
	isStatusBarLyricsEnabled: boolean
	/** 是否把翻译歌词写入 Android Auto / 车机媒体元数据。 */
	isCarLyricsEnabled: boolean
	/**
	 * Android 状态栏歌词后端 id。
	 *
	 * 在 API 27 以下的 Android 版本设置 `lyricon` 时，原生端会按降级逻辑实际保存为
	 * `superlyric`。
	 */
	statusBarLyricsProvider: string
	/** SuperLyric 状态栏 API 在当前设备上是否报告为可用。 */
	readonly isSuperLyricApiEnabled: boolean
	/** 当前 Lyricon 后端在设备上是否可用；API 27 以下始终为 false。 */
	readonly isLyriconApiEnabled: boolean
	/** 当前 Android 系统是否为受支持的魅族/Flyme 状态栏歌词环境。 */
	readonly isMeizuStatusBarLyricsApiEnabled: boolean

	/** 返回当前播放位置，单位为秒。 */
	getPosition(): Promise<number>
	/** 返回当前曲目时长，单位为秒；当 Media3 的时长未设置时返回 `0`。 */
	getDuration(): Promise<number>
	/** 返回当前已缓冲到的播放位置，单位为秒。 */
	getBuffered(): Promise<number>
	/** 返回原生播放器当前是否正在播放。 */
	getIsPlaying(): Promise<boolean>
	/** 返回当前 Media3 物理队列索引。 */
	getCurrentIndex(): Promise<number>
	/** 返回当前曲目元数据；没有选中媒体项时返回 `null`。 */
	getCurrentTrack(): Promise<Track | null>
	/** 返回 Android 随机播放管理器维护的已持久化随机播放偏好。 */
	getShuffleMode(): Promise<boolean>
	/**
	 * 按物理队列索引返回曲目。
	 *
	 * 索引无效时返回 `null`。
	 */
	getIndexTrack(index: number): Promise<Track | null>
	/** 返回当前重复模式，取值使用导出的 `RepeatMode`。 */
	getRepeatMode(): Promise<RepeatMode>
	/** 保存原生 Bilibili 网络请求使用的 Cookie。 */
	setBilibiliCookie(cookie: string): void
	/**
	 * 开始或恢复播放。
	 *
	 * 如果播放已经结束，原生端会先跳回开头再播放。如果播放器处于 idle 且队列非空，
	 * 原生端会先 prepare。
	 */
	play(): Promise<void>
	/** 暂停播放，不清空队列，也不改变当前播放位置。 */
	pause(): Promise<void>
	/** 清空原生播放队列中的所有媒体项。 */
	clear(): Promise<void>
	/**
	 * 跳转到 `index` 对应曲目的开头。
	 *
	 * 随机播放开启时，`index` 会被解释为随机播放遍历顺序中的逻辑索引，
	 * 与 `getQueue()` 返回的顺序一致。
	 */
	skipTo(index: number): Promise<void>
	/**
	 * 如果存在下一首，则跳转到下一首。
	 *
	 * 在单曲循环模式下，Android 会从最后一首回绕到第一首。
	 */
	skipToNext(): Promise<void>
	/**
	 * 如果存在上一首，则跳转到上一首。
	 *
	 * 在单曲循环模式下，Android 会从第一首回绕到最后一首。
	 */
	skipToPrevious(): Promise<void>
	/** 在当前曲目内跳转；`seconds` 会在原生端转换为毫秒。 */
	seekTo(seconds: number): Promise<void>
	/** 设置重复模式；Android 会把未知数字值当作 `RepeatMode.OFF` 处理。 */
	setRepeatMode(mode: RepeatMode): Promise<void>
	/**
	 * 开启或关闭随机播放。
	 *
	 * 如果 Android 服务尚未绑定，偏好会先持久化，之后由服务恢复播放器状态时读取。
	 */
	setShuffleMode(enabled: boolean): Promise<void>
	/**
	 * 返回播放队列。
	 *
	 * 随机播放开启时，Android 会按随机播放的逻辑遍历顺序返回队列，
	 * 让 UI 看到实际接下来会播放的顺序。
	 */
	getQueue(): Promise<Track[]>
	/**
	 * 将曲目追加到队列末尾。
	 *
	 * `clearQueue` 为 true 时会先清空现有队列。`startFromId` 命中本次追加的曲目时，
	 * 原生端会跳转到该新插入曲目，prepare 播放器并开始播放。
	 */
	addToEnd(
		tracks: Track[],
		startFromId?: string,
		clearQueue?: boolean,
	): Promise<void>
	/**
	 * 将 `track` 放到当前曲目之后。
	 *
	 * 如果队列中已经存在同一曲目，会移动已有项而不是重复添加；当前正在播放的同一曲目不会被移动。
	 * 随机播放模式下也会同步更新遍历顺序，让该曲目成为逻辑上的下一首。
	 */
	playNext(track: Track): Promise<void>
	/**
	 * 按索引移除队列项。
	 *
	 * 随机播放开启时，`index` 会被解释为随机播放遍历顺序中的逻辑索引。
	 */
	removeTrack(index: number): Promise<void>
	/**
	 * 启动或替换睡眠定时器。
	 *
	 * Android 会在定时器触发时暂停播放。非正数时长会取消定时器。
	 */
	setSleepTimer(durationMs: number): Promise<void>
	/**
	 * 返回睡眠定时器结束的 wall-clock 时间戳，单位为毫秒。
	 *
	 * 没有仍在未来触发的定时器时返回 `null`。
	 */
	getSleepTimerEndTime(): Promise<number | null>
	/** 取消当前睡眠定时器；没有定时器时不做任何事。 */
	cancelSleepTimer(): Promise<void>
	/** 将单个曲目加入 Media3 离线下载队列。 */
	downloadTrack(track: Track): Promise<void>
	/**
	 * 移除下载任务及其本地缓存封面。
	 *
	 * 移除操作会异步发送给 Media3 DownloadService。
	 */
	removeDownload(id: string): Promise<void>
	/** 批量移除下载任务及其本地缓存封面。 */
	removeDownloads(ids: string[]): Promise<void>
	/** 将多个曲目加入 Media3 离线下载队列。 */
	multiDownload(tracks: Track[]): Promise<void>
	/** 清除已停止下载的 stop reason，让 Media3 可以继续下载。 */
	resumeDownload(id: string): Promise<void>
	/** 重新添加曲目下载请求，让 Media3 可以重试失败任务。 */
	retryDownload(track: Track): Promise<void>
	/** 设置 Media3 下载任务的最大并行数量。 */
	setDownloadMaxParallelTasks(maxParallelTasks: number): Promise<void>
	/** 移除所有下载任务以及全部本地缓存封面。 */
	removeAllDownloads(): Promise<void>
	/** 返回 Media3 DownloadManager 当前已知的全部任务。 */
	getDownloads(): Promise<DownloadTask[]>
	/**
	 * 返回指定 id 对应的下载状态。
	 *
	 * 不存在的 id 会从返回结果中省略。
	 */
	getDownloadStatusByIds(ids: string[]): Promise<Record<string, DownloadState>>
	/** 移除所有未完成的 Media3 下载任务；已完成下载会保留。 */
	clearUncompletedDownloadTasks(): Promise<void>
	/** 返回所有未完成的 Media3 下载任务。 */
	getUncompletedDownloadTasks(): Promise<DownloadTask[]>
	/**
	 * 启动一次后台补齐封面的流程，为已完成下载补下载缺失封面文件。
	 *
	 * Promise 会返回本次发现的待下载封面数量。进度和失败信息通过
	 * `onCoverDownloadProgress` 事件上报。
	 */
	downloadMissingCovers(): Promise<number>
	/** 返回已下载封面的本地 `file://` URI；不存在时返回 `null`。 */
	getDownloadedCoverUri(trackId: string): string | null
	/**
	 * 将已下载曲目导出到持久化授权的 document-tree URI。
	 *
	 * 进度和错误通过 `onExportProgress` 事件上报；Promise 在导出任务被调度后 resolve。
	 */
	exportDownloads(
		ids: string[],
		destinationUri: string,
		filenamePattern: string | null,
		embedLyrics: boolean,
		convertToLrc: boolean,
		cropCoverArt: boolean,
	): Promise<void>
	/**
	 * 打开 Android 目录选择器并返回选中的 tree URI。
	 *
	 * Android 会在返回前尝试持久化读写权限。用户取消选择或 React context 不可用时返回
	 * `null`。
	 */
	selectDirectory(): Promise<string | null>
	/** 返回 Android 当前是否可以处理 `ACTION_OPEN_DOCUMENT_TREE`。 */
	isDirectoryPickerAvailable(): Promise<boolean>
	/** 返回 Android 悬浮窗权限当前是否已授予。 */
	checkOverlayPermission(): Promise<boolean>
	/**
	 * 在缺少权限时打开 Android 悬浮窗权限设置页。
	 *
	 * 该方法不会等待用户完成授权。
	 */
	requestOverlayPermission(): Promise<void>
	/** 当 Android 服务可用时显示桌面悬浮歌词。 */
	showDesktopLyrics(): Promise<void>
	/** 当 Android 服务可用时隐藏桌面悬浮歌词。 */
	hideDesktopLyrics(): Promise<void>
	/**
	 * 仅供原生桥接使用的歌词入口。
	 *
	 * JS 业务代码应使用 `setLyrics`，由它负责序列化 `LyricsData`，并默认分发给桌面、
	 * 状态栏和车机歌词消费者。
	 */
	setLyricsInternal(
		lyricsJson: string,
		consumers: LyricConsumer[],
	): Promise<void>
	/**
	 * 软清理所有歌词消费者。
	 *
	 * Android 会临时隐藏 overlay，但保留已持久化的用户偏好，因此之后重新收到歌词时，
	 * 已启用的消费者可以再次显示。
	 */
	clearOverlays(): Promise<void>
	/** 设置原生播放倍速。 */
	setPlaybackSpeed(speed: number): Promise<void>
	/** 返回当前原生播放倍速。 */
	getPlaybackSpeed(): Promise<number>
	/**
	 * 触发原生播放错误路径，用于调试错误处理。
	 *
	 * 该调试钩子目前由 iOS 模块实现；Android 没有定义同名原生方法。
	 */
	debugTriggerError(): Promise<void>
	/**
	 * 将最新原生频谱数据复制到 `destination`。
	 *
	 * 建议复用长度为 `SPECTRUM_SIZE` 的 `Float32Array`，避免在动画循环中反复分配。
	 */
	updateSpectrumData(destination: Float32Array): void
	/**
	 * 从 `uris` 中筛出原生 LRU 缓存当前已知的完整缓存 URI。
	 *
	 * 缓存状态由 Android 缓存监听器异步维护。
	 */
	getLruCachedUris(uris: string[]): string[]
}

const NativeModuleInstance = requireNativeModule<NativeOrpheusModule>('Orpheus')

type PublicOrpheusModule = Omit<NativeOrpheusModule, 'setLyricsInternal'> & {
	/**
	 * 将已解析歌词提交给原生消费者。
	 *
	 * 默认会分发给桌面悬浮歌词、状态栏歌词和车机媒体元数据消费者。传入 `consumers`
	 * 可以只更新指定目标。
	 */
	setLyrics(data: LyricsData, consumers?: LyricConsumer[]): Promise<void>
}

/**
 * Orpheus 模块的包装对象，提供更好的类型支持和便捷方法。
 */
export const Orpheus = NativeModuleInstance as unknown as PublicOrpheusModule

Orpheus.setLyrics = async (
	data: LyricsData,
	consumers: LyricConsumer[] = ['desktop', 'statusBar', 'car'],
) => {
	return await NativeModuleInstance.setLyricsInternal(
		JSON.stringify(data),
		consumers,
	)
}

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
