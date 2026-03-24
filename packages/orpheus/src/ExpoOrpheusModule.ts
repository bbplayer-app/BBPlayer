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
	onRequestClearLyrics(event: { trackId: string }): void
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

/** 内部使用的原生接口定义 */
declare class NativeOrpheusModule extends NativeModule<OrpheusEvents> {
	restorePlaybackPositionEnabled: boolean
	loudnessNormalizationEnabled: boolean
	autoplayOnStartEnabled: boolean
	isDesktopLyricsShown: boolean
	isDesktopLyricsLocked: boolean
	isStatusBarLyricsEnabled: boolean
	statusBarLyricsProvider: string
	readonly isSuperLyricApiEnabled: boolean
	readonly isLyriconApiEnabled: boolean

	getPosition(): Promise<number>
	getDuration(): Promise<number>
	getBuffered(): Promise<number>
	getIsPlaying(): Promise<boolean>
	getCurrentIndex(): Promise<number>
	getCurrentTrack(): Promise<Track | null>
	getShuffleMode(): Promise<boolean>
	getIndexTrack(index: number): Promise<Track | null>
	getRepeatMode(): Promise<RepeatMode>
	setBilibiliCookie(cookie: string): void
	play(): Promise<void>
	pause(): Promise<void>
	clear(): Promise<void>
	skipTo(index: number): Promise<void>
	skipToNext(): Promise<void>
	skipToPrevious(): Promise<void>
	seekTo(seconds: number): Promise<void>
	setRepeatMode(mode: RepeatMode): Promise<void>
	setShuffleMode(enabled: boolean): Promise<void>
	getQueue(): Promise<Track[]>
	addToEnd(
		tracks: Track[],
		startFromId?: string,
		clearQueue?: boolean,
	): Promise<void>
	playNext(track: Track): Promise<void>
	removeTrack(index: number): Promise<void>
	setSleepTimer(durationMs: number): Promise<void>
	getSleepTimerEndTime(): Promise<number | null>
	cancelSleepTimer(): Promise<void>
	downloadTrack(track: Track): Promise<void>
	removeDownload(id: string): Promise<void>
	removeDownloads(ids: string[]): Promise<void>
	multiDownload(tracks: Track[]): Promise<void>
	removeAllDownloads(): Promise<void>
	getDownloads(): Promise<DownloadTask[]>
	getDownloadStatusByIds(ids: string[]): Promise<Record<string, DownloadState>>
	clearUncompletedDownloadTasks(): Promise<void>
	getUncompletedDownloadTasks(): Promise<DownloadTask[]>
	downloadMissingCovers(): Promise<number>
	getDownloadedCoverUri(trackId: string): string | null
	exportDownloads(
		ids: string[],
		destinationUri: string,
		filenamePattern: string | null,
		embedLyrics: boolean,
		convertToLrc: boolean,
		cropCoverArt: boolean,
	): Promise<void>
	selectDirectory(): Promise<string | null>
	checkOverlayPermission(): Promise<boolean>
	requestOverlayPermission(): Promise<void>
	showDesktopLyrics(): Promise<void>
	hideDesktopLyrics(): Promise<void>
	setDesktopLyricsInternal(lyricsJson: string): Promise<void>
	clearOverlaysInternal(): Promise<void>
	setStatusBarLyricsInternal(lyricsJson: string): Promise<void>
	setPlaybackSpeed(speed: number): Promise<void>
	getPlaybackSpeed(): Promise<number>
	debugTriggerError(): Promise<void>
	updateSpectrumData(destination: Float32Array): void
	getLruCachedUris(uris: string[]): string[]
}

const NativeModuleInstance = requireNativeModule<NativeOrpheusModule>('Orpheus')

/**
 * Orpheus 模块的包装对象，提供更好的类型支持和便捷方法。
 */
export const Orpheus = NativeModuleInstance as NativeOrpheusModule & {
	setDesktopLyrics(data: LyricsData): Promise<void>
	setStatusBarLyrics(data: LyricsData): Promise<void>
	clearOverlays(): Promise<void>
}

/**
 * 设置桌面歌词数据
 */
Orpheus.setDesktopLyrics = async (data: LyricsData) => {
	return await NativeModuleInstance.setDesktopLyricsInternal(
		JSON.stringify(data),
	)
}

/**
 * 设置状态栏歌词数据
 */
Orpheus.setStatusBarLyrics = async (data: LyricsData) => {
	return await NativeModuleInstance.setStatusBarLyricsInternal(
		JSON.stringify(data),
	)
}

/**
 * 当没有歌词时清除并隐藏所有歌词 overlay（桌面歌词面板 + 状态栏歌词）
 */
Orpheus.clearOverlays = async () => {
	return await NativeModuleInstance.clearOverlaysInternal()
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
