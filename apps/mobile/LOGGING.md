# 日志约定

JS 和 Android 自有日志使用相同的结构：稳定事件名、扁平属性、明确级别。
事件名是 Sentry Logs 的 message，不包含歌曲、用户、异常文本等动态内容。

```ts
logger.info('player.state.changed', {
	'track.id': trackId,
	'player.state': 'BUFFERING',
	'player.position_ms': positionMs,
})

logger.error('playlist.sync.failed', { 'playlist.id': playlistId }, error)
```

```kotlin
import expo.modules.bbplayernative.telemetry.NativeLog

NativeLog.info(
    LogTags.SERVICE,
    "player.state.changed",
    mapOf(
        "track.id" to mediaId,
        "player.state" to stateName,
        "player.position_ms" to positionMs,
    ),
)
```

- 事件名使用小写 `domain.action`，多词用下划线，如 `stream.mirror.open_failed`。
  同一事件的动态值只放进属性。JS lint 会拒绝插值消息或动态事件名。
- 属性使用带命名空间的 `snake_case`，如 `track.id`、`http.status_code`。
  数值写清单位，如 `duration_ms`、`size_bytes`、`sample_rate_hz`。
- 属性只选取诊断所需的字符串、数字、布尔值或基本类型数组，不上传完整业务对象、
  HTTP 响应、播放器对象或配置。JS 类型约束禁止嵌套对象；Android 调用方同样遵守此约定。
- JS 通过第三个参数传异常，统一生成 `error.type` 和 `error.message`。
  Android 通过 `error` 参数传异常，本地 Logcat 保留堆栈，远端记录错误类型和消息。
- `log.scope` 保留 JS 作用域，`log.tag` 保留 Android tag。
- `info` 记录业务阶段与状态变化，`warning` 记录可恢复异常，`error` 记录功能失败，
  `debug` 记录排查细节。完成事件尽量带上结果、数量、耗时等信息。
- 调用方负责选择安全字段，不传 cookie、token、签名 URL 等敏感信息。
  不增加字段白名单；现有 Sentry 脱敏回调继续作为兜底。

## 输出与限流

JS 保留文件日志和开发控制台输出；生产环境输出结构化 Sentry Logs 和 breadcrumb。
Android 统一由 NativeLog 输出 Logcat，并直接调用 Sentry logger；不再自动收集全部
Logcat，因此第三方库的普通 Logcat 不会进入 Sentry Logs。

远端 debug 日志不发送。JS 本地 debug 仍由开发环境或用户的调试日志开关控制；
Android debug 保留在本地 Logcat。
性能诊断的 `__PERF_METRICS__` 控制台标记保留供工具解析，不属于 Sentry Logs。

JS 和 Android 分别维护进程内的 60 秒固定窗口：

- info、warning、error 三个桶互不占用额度，fatal 归入 error。
- 每个桶最多 600 条；同一事件、作用域及级别桶最多 30 条。
- Android 原生 breadcrumb 的每桶额度为 30 条，同事件额度为 3 条，仅记录 warning/error。
- 超限只丢弃远端记录，本地日志继续输出。窗口重置后下一条同类记录附带
  `bbplayer.rate_limited_before`；breadcrumb 使用 `rate_limited_before`。
- 重启进程会重置计数。这里不是整个组织的全局配额，也不是滑动窗口。

Android native 的入口与限流位于 `packages/native`，播放器、主题色模块和滑块模块共用它。
当前原生 Sentry Logs 集成针对 Android；iOS 没有对应的 NativeTelemetry 接入。

参考：<https://sentry.io/cookbook/structure-your-logs/>
