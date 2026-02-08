# API 方法

获得 `Orpheus` 模块实例后可调用的方法。

## 模块属性 (Module Properties)

- **`restorePlaybackPositionEnabled: boolean`**
  是否开启恢复播放进度。
- **`loudnessNormalizationEnabled: boolean`**
  是否开启响度标准化。
- **`autoplayOnStartEnabled: boolean`**
  是否开启启动时自动播放。
- **`isDesktopLyricsShown: boolean`**
  桌面歌词是否显示中。
- **`isDesktopLyricsLocked: boolean`**
  桌面歌词是否锁定（不可拖动）。

## 播放控制 (Playback Control)

- **`play(): Promise<void>`**
  恢复播放。

- **`pause(): Promise<void>`**
  暂停播放。

- **`skipToNext(): Promise<void>`**
  跳至下一首。

- **`skipToPrevious(): Promise<void>`**
  跳至上一首。

- **`skipTo(index: number): Promise<void>`**
  跳至播放队列中的指定索引。

- **`seekTo(seconds: number): Promise<void>`**
  跳转到当前曲目的指定时间（单位：秒）。

- **`setPlaybackSpeed(speed: number): Promise<void>`**
  设置播放倍速 (如 1.0, 1.25, 2.0)。

- **`getPlaybackSpeed(): Promise<number>`**
  获取当前倍速。

- **`getPosition(): Promise<number>`**
  获取当前播放进度（秒）。

- **`getDuration(): Promise<number>`**
  获取当前曲目总时长（秒）。

- **`getBuffered(): Promise<number>`**
  获取当前缓冲进度（秒）。

- **`getIsPlaying(): Promise<boolean>`**
  获取当前是否正在播放。

- **`getShuffleMode(): Promise<boolean>`**
  获取随机模式状态。

- **`getRepeatMode(): Promise<RepeatMode>`**
  获取当前重复模式。

- **`setRepeatMode(mode: RepeatMode): Promise<void>`**
  设置重复模式。

- **`setShuffleMode(enabled: boolean): Promise<void>`**
  设置随机模式。

## 队列管理 (Queue Management)

- **`addToEnd(tracks: Track[], startFromId?: string, clearQueue?: boolean): Promise<void>`**
  将歌曲添加到队列末尾。
  - `tracks`: 歌曲列表。
  - `startFromId` (可选): 添加后由该 ID 开始播放。
  - `clearQueue` (可选): 是否先清空队列。

- **`playNext(track: Track): Promise<void>`**
  插队播放（下一首）。

- **`clear(): Promise<void>`**
  清空队列。

- **`removeTrack(index: number): Promise<void>`**
  移除指定索引的歌曲。

- **`getQueue(): Promise<Track[]>`**
  获取完整播放队列。

- **`getCurrentIndex(): Promise<number>`**
  获取当前播放索引。

- **`getCurrentTrack(): Promise<Track | null>`**
  获取当前播放对象。

- **`getIndexTrack(index: number): Promise<Track | null>`**
  获取指定索引的对象。

## 下载管理 (Downloads)

Orpheus 使用 Media3 DownloadManager。

- **`downloadTrack(track: Track): Promise<void>`**
  下载单曲。

- **`multiDownload(tracks: Track[]): Promise<void>`**
  批量下载。

- **`removeDownload(id: string): Promise<void>`**
  移除下载。

- **`removeAllDownloads(): Promise<void>`**
  清空下载缓存。

- **`getDownloads(): Promise<DownloadTask[]>`**
  获取所有下载任务。

- **`getDownloadStatusByIds(ids: string[]): Promise<Record<string, DownloadState>>`**
  批量查询下载状态。

- **`getUncompletedDownloadTasks(): Promise<DownloadTask[]>`**
  获取未完成任务。

- **`clearUncompletedDownloadTasks(): Promise<void>`**
  清除未完成（失败/停止）的任务。

## 杂项与配置 (Misc)

- **`setSleepTimer(durationMs: number): Promise<void>`**
  设置睡眠定时器（毫秒）。

- **`getSleepTimerEndTime(): Promise<number | null>`**
  获取定时器结束时间戳。

- **`cancelSleepTimer(): Promise<void>`**
  取消定时器。

- **`setBilibiliCookie(cookie: string): void`**
  设置 Bilibili Cookie。

- **`showDesktopLyrics() / hideDesktopLyrics()`**
  显示/隐藏桌面歌词。

- **`checkOverlayPermission() / requestOverlayPermission()`**
  权限检查与请求。

- **`setDesktopLyrics(json: string)`**
  更新歌词内容。

## 频谱数据 (Spectrum)

- **`updateSpectrumData(destination: Float32Array): void`**
  同步更新提供的 `Float32Array` 为最新的频谱频率数据。建议在 JS 端创建一次并在动画循环中重复使用。
