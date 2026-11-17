# 原生 tracing

Orpheus 在原生侧记录两类 span：

- **等待出声**：`PlaybackTracer` 记录 `playback.wait_for_audio` transaction，即用户想播但还没出声的这段时间。
- **请求**：`BilibiliRepository.execute` 为 nav、playurl、pagelist 每次请求记录一个 `http.client` span。span 名和属性与 JS 侧 `ApiClient` 一致，所以 Sentry 里的 Bilibili API monitor 和 dashboard 会把两侧的请求放在一起统计。用属性 `bbplayer.source: native` 可以区分原生请求。

## 等待出声

主动播放或选曲播放时，在 `addMediaItems`、`seekTo`、`prepare` 之前创建 `playback.wait_for_audio`，出声时结束。加载线程可能在 `playWhenReady` 回调之前开始取流，等回调才创建 transaction 会让请求失去 parent。同一曲目的后续切歌回调复用已创建的 transaction。

通知栏、耳机、自动下一首等入口仍由播放服务的回调兜底：切歌或按下播放时，如果 `playWhenReady && !isPlaying` 成立就开始，出声时结束。

主动播放已缓存的歌曲时可能只记录一段很短的等待；没有主动播放命令的回调路径仍按上述条件判断。播放中途的卡顿缓冲不算。

| 情况                                 | 状态                | 额外属性                           |
| ------------------------------------ | ------------------- | ---------------------------------- |
| 开始出声（`isPlaying` 变为 true）    | `ok`                |                                    |
| 出声前切到别的歌、用户暂停、服务销毁 | `cancelled`         | `playback.cancelled`               |
| 播放器报错                           | `internal_error`    | `error.type` 为 ExoPlayer 错误码名 |
| 30 秒内没出声                        | `deadline_exceeded` | `playback.timed_out`               |

- `playback.reason`：ExoPlayer 的切歌原因（`AUTO`、`SEEK`、`PLAYLIST_CHANGED`），按下播放时为 `PLAY`。单曲循环回到开头不算。
- 等待期间如果为这首歌请求了地址，请求 span 会挂在它下面，并把 `playback.resolved_url` 设为 `true`（默认 `false`，表示直接用了缓存的地址）。它是布尔属性，在 Explore 里要写成 `tags[playback.resolved_url,boolean]:true` 才能筛选。判断方式是取流的 URI 和当前等待的 URI 一致；预加载下一首、下载触发的请求仍然各自是独立的 transaction。
- 和 JS 侧是独立的 trace。JS 的 `playback.submit` 只记录校验、查歌单、调用原生这几步，它的 `playback.starting_track_id` 对应这里的 `track.id`。

### 起播阶段

| span                          | 起止边界                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `playback.prepare`            | 播放请求 → 开始解析地址；包含队列操作、Media3 准备、缓存检查与加载线程调度。缓存命中时，到音频格式回调结束。 |
| `playback.resolve_audio`      | 地址解析开始 → 解析结果和请求头准备完成；Bilibili 的 `nav`、`pagelist`、`playurl` 请求作为它的子 span。      |
| `playback.await_retry`        | 地址解析失败 → 下一次解析或播放结束。                                                                        |
| `playback.await_audio_format` | 地址解析完成 → 收到音频输入格式；包含 CDN 读取、容器探测与轨道识别。                                         |
| `playback.await_audio_output` | 收到音频输入格式 → AudioTrack 初始化；包含解码器和输出准备。                                                 |
| `playback.await_playing`      | AudioTrack 初始化 → `isPlaying=true`；包含剩余缓冲和播放状态切换的等待。                                     |

这些阶段按实际回调切换，不代表每段只执行一种工作；复用音频输出时可能没有新的 AudioTrack 初始化回调，当前阶段会延续到起播结束。

另有更细的子 span：

- `playback.wbi_keys`：取得 WBI 密钥，包含缓存/锁等待和必要时的 `nav` 请求。
- `playback.api.prepare`：Retrofit API/转换器首次初始化及请求构造，不包含发起网络请求。
- `playback.wbi_sign`：生成 WBI 请求签名。
- `playback.cdn.open`（`http.client`）：每次 CDN `DataSource.open`，包含连接及等待 HTTP 响应头，镜像重试分别记录；只上传主机，不记录带签名的 URL。
- `playback.cdn.first_read`：打开后到第一次读取返回数据或 EOF，不能当作完整音频下载耗时。
- `playback.decoder_init`：使用 Media3 报告的初始化时刻和耗时补记解码器初始化，不把主线程回调排队时间算进去。

CDN span 仅绑定当前等待出声的曲目。暂停、切歌、失败或超时时会结束未完成的阶段和任务，不会把下载或持续播放中的读取混进下一次起播。

## 依赖的 SDK 内部行为

`@sentry/react-native` 在初始化原生 SDK 时会把 `tracesSampleRate` 置空，防止原生和 JS 各记一份导航 span。在这种状态下，原生侧手动创建的 transaction 都会被丢弃。

我们的做法是等 RN SDK 初始化完成后，在 JS 的 `onReady` 里调用 `setNativeTracesSampleRate`，由 `@bbplayer/native` 的 `NativeTelemetry.setTracesSampleRate` 改写原生 options。这样做不会带来重复的自动采集，原因是 sentry-android（8.64）的各项自动 tracing 判断开关的时机不同：

| 自动采集                                                       | 判断 tracing 是否开启的时机                               | 初始化后再打开的结果 |
| -------------------------------------------------------------- | --------------------------------------------------------- | -------------------- |
| Activity 生命周期、app start（`ActivityLifecycleIntegration`） | `register()` 时写入 `performanceEnabled`                  | 不生效               |
| 帧率统计（`SpanFrameMetricsCollector`）                        | 构造时                                                    | 不生效               |
| 手势 tracing（`SentryGestureListener`）                        | 每次手势时，还要求 `enableUserInteractionTracing` 为 true | 我们显式设为 false   |
| 手动 `Sentry.startTransaction`                                 | 每次调用时检查 `isTracingEnabled`                         | 生效，这正是我们要的 |

这几条都不是公开 API 的承诺。SDK 一旦改为运行时判断，就可能出现重复的导航 span 或多出帧率数据。

## 升级 Sentry 时的检查

升级 `@sentry/react-native` 时，它带的 sentry-android 版本也会变。升级后需要确认：

1. **RN SDK 是否仍然置空原生 `tracesSampleRate`**：看 `@sentry/react-native/android/src/main/java/io/sentry/react/RNSentryStart.java` 里的 `updateWithReactDefaults`。如果它不再置空，或者提供了只开手动 transaction 的正式配置，就可以删掉 `setNativeTracesSampleRate`，改用正式配置。
2. **上面表格里的判断时机有没有变**：在 sentry-android 对应版本的源码里看 `ActivityLifecycleIntegration.register`、`SpanFrameMetricsCollector` 的构造函数和 `SentryGestureListener`。
3. **线上实际表现**：新版本发布一段时间后，在 Sentry Explore 的 spans 里查询：
   - `transaction:MainActivity` 或 `span.op:ui.load sdk.name:*android*` 应该没有结果，有结果就说明 Activity 自动 tracing 被打开了。
   - `bbplayer.source:native` 应该能查到原生请求，查不到就说明手动 transaction 没有被发送。

如果检查发现行为变了，又没有简单的修法，就先在 JS 里去掉 `setNativeTracesSampleRate(TRACES_SAMPLE_RATE)` 这一行。原生的等待出声和请求就都没有 span 了，但请求失败时仍会通过 `bilibili.api.request_failed` 日志上报，排查不会断。

## 为什么不在 `RNSentrySDK.init` 的回调里打开

RN SDK 支持在 `MainApplication` 里用 `RNSentrySDK.init(context) { options -> ... }` 提前初始化原生 SDK，回调里设置的 options 会覆盖 RN 默认值。但 JS 的 `Sentry.init` 随后会重新初始化原生 SDK（sentry-java 会打出 `Previous configuration will be overwritten`），`tracesSampleRate` 又被置空，回调也不会再执行一次。设置 `autoInitializeNativeSdk: false` 可以避免重新初始化，但那样 JS 的 options 不会传给原生，DSN、release、`beforeSend`、脱敏都得在原生侧再配置一遍。所以目前选择在 JS 初始化之后再改写原生 options。

## 已知限制

- 采样率与 JS 共用 `apps/mobile/src/lib/config/sentry.ts` 里的 `TRACES_SAMPLE_RATE`。
- 旧版原生包运行新版 JS（OTA）时没有 `setNativeTracesSampleRate`。调用失败会被 try/catch 吞掉，这时只是原生没有 span。
- 只实现了 Android。
