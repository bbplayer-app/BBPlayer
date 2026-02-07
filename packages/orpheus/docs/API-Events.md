# 事件与后台任务

## 事件监听 (Events)

使用 `Orpheus.addListener(eventName, callback)` 进行监听。

| 事件名                   | 参数                                   | 描述                                         |
| :----------------------- | :------------------------------------- | :------------------------------------------- |
| `onPlaybackStateChanged` | `{ state: PlaybackState }`             | 播放状态改变 (IDLE, BUFFERING, READY, ENDED) |
| `onIsPlayingChanged`     | `{ status: boolean }`                  | 播放/暂停状态改变                            |
| `onTrackFinished`        | `{ trackId, finalPosition, duration }` | 歌曲播放完成                                 |
| `onPositionUpdate`       | `{ position, duration, buffered }`     | 进度更新 (约 500ms 一次)                     |
| `onPlayerError`          | `{ code, message }`                    | 播放器报错                                   |
| `onDownloadUpdated`      | `DownloadTask`                         | 下载进度更新                                 |
| `onPlaybackSpeedChanged` | `{ speed: number }`                    | 倍速改变                                     |

**注意**: `onTrackStarted` 事件在 v0.9.0+ 已移除，请使用 Headless Task。

## 后台任务 (Headless Task)

为了在 App 后台或被杀掉进程时仍能处理切歌等逻辑（如更新通知栏或以前的 `onTrackStarted` 逻辑），你需要注册 Headless Task。

```typescript
import { registerOrpheusHeadlessTask } from '@bbplayer/orpheus'

registerOrpheusHeadlessTask(async (event) => {
	// 目前主要处理 TrackStarted 事件
	if (event.eventName === 'onTrackStarted') {
		console.log('开始播放:', event.trackId)
		console.log('原因:', event.reason) // 0: REPEAT, 1: AUTO, 2: SEEK, 3: PLAYLIST_CHANGED
	}
})
```

必须在 `index.js` 或应用启动的最早时期注册。
