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
	onPlaybackSpeedChanged(event: { speed: number }): void
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
