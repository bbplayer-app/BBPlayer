# 数据类型 (Types)

## Track

核心音频对象结构。

```typescript
export interface Track {
	/** 唯一标识符 */
	id: string

	/**
	 * 音频流地址。
	 * 特殊协议: orpheus://bilibili?bvid=...
	 */
	url: string

	/** 标题 */
	title?: string

	/** 艺术家 */
	artist?: string

	/** 封面图 URL */
	artwork?: string

	/** 时长 (秒) */
	duration?: number
}
```

## TransitionReason

触发切歌的原因。

```typescript
export enum TransitionReason {
	REPEAT = 0, // 重复播放
	AUTO = 1, // 自动切下一首
	SEEK = 2, // 跳转
	PLAYLIST_CHANGED = 3, // 播放列表改变
}
```

## PlaybackState

播放器状态枚举。

```typescript
export enum PlaybackState {
	IDLE = 1, // 空闲 / 无资源
	BUFFERING = 2, // 缓冲中
	READY = 3, // 准备就绪 / 可播放
	ENDED = 4, // 播放结束
}
```

## RepeatMode

重复模式。

```typescript
export enum RepeatMode {
	OFF = 0, // 不重复
	TRACK = 1, // 单曲循环
	QUEUE = 2, // 列表循环
}
```

## DownloadTask & DownloadState

下载任务详情。

```typescript
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
	percentDownloaded: number // 0 - 100
	bytesDownloaded: number
	contentLength: number
	track?: Track // 关联的 Track 对象信息
}
```

## PlaybackErrorEvent

播放错误详情。

```typescript
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
```

## OrpheusHeadlessEvent

后台任务接收的事件类型。

```typescript
export interface OrpheusHeadlessTrackStartedEvent {
	eventName: 'onTrackStarted'
	trackId: string
	reason: TransitionReason
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
```
