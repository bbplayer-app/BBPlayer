# BBPlayer 自研原生库 Android / iOS 对齐评估

评估日期：2026-11-10。分支：`feat/ios-port`。

本轮为静态源码审计：核对原生导出、内部实现及应用调用路径；没有修改业务代码，没有重新构建或执行功能测试。前面安装成功和能够播放，只证明基本启动/播放路径，不代表以下能力已通过设备验收。

## 处理状态

状态更新：2026-11-14。本节和各处“状态”标记在审计之后补充，审计正文保留原样，文中的文件行号对应审计时的代码。

| 状态     | 含义                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| 已修复   | 代码已修改，并通过 Linux 回归测试（真实 Swift 代码加模拟 AVPlayer，用例未入库）；尚待真机复测 |
| 真机通过 | 已在 iPhone 或 iPad 上实测没问题，当前无需修改                                                |
| 待验证   | 代码未改，需要真机或长时间运行才能下结论                                                      |
| 未处理   | 不在 iOS 首版范围内，保留为后续工作                                                           |
| 无需处理 | 平台差异，或已有替代方案                                                                      |

## 范围与总体结论

按 Git 跟踪的原生源文件与 Expo 模块注册，当前自研原生实现集中在四个包。

| 库                             | Android                                                                  | iOS                                                     | 判断                                   |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------- |
| `@bbplayer/orpheus`            | Media3 播放、下载、缓存、音频处理、系统媒体服务、歌词                    | AVPlayer 播放、URLSession 下载、队列、FFT、系统媒体控制 | 主干已移植，完整行为尚未对齐           |
| `@bbplayer/native`             | 通用原生工具、存储统计/浏览、解压、APK 安装、备份导出、启动视频、TV 焦点 | 没有 iOS 原生模块；部分上层使用替代方案                 | 需要区分缺失与合理的平台分工           |
| `expo-wavy-slider`             | Compose 波形滑条与原生共享状态                                           | `PlainSlider` JS/Reanimated 回退                        | 基础拖动可用，视觉和部分交互参数未对齐 |
| `@bbplayer/image-theme-colors` | Android Palette                                                          | swift-vibrant                                           | API 已实现，但结果语义存在差异         |

`bottom-tabs-react-navigation` / `react-native-bottom-tabs` 在当前工作树中没有 Git 跟踪的实现文件，也没有出现在 mobile 当前依赖中，不作为正在使用的自研原生实现计入。其余 heatmap、logs、splash、eslint-plugin 没有 Git 跟踪的原生实现。

Orpheus 的 Android 62 个导出方法、15 个属性在 iOS 都有同名声明。这个数字不能表示功能完成率：iOS 的部分方法仅返回空值或直接抛出不支持，部分属性只有存储没有消费逻辑；下载等接口还存在同步/异步契约差异。

## 优先处理的功能差异

### P1：播客逐首断点续播缺失；普通冷启动续播也有缺口

**状态：真机通过。** 逐首断点已按 Android 语义实现，`applyResumeStrategy()` 不再排除 iOS。关闭自动播放时，保存位置会保留到首次播放，播放前拖动也会保留。播放中每 5 秒落盘一次。

- Android 有 `TrackResumeStorage`，按曲目保存断点，在切歌/暂停/seek/周期采样时更新，并在进入曲目时应用。
- iOS `playbackResumeStrategy` 仅写入 MMKV，播放器没有读取它；应用 `applyResumeStrategy()` 还直接排除了非 Android。
- 因此 iOS 的播客模式没有 Android 的逐首续播能力。
- 即使普通的“恢复上次位置”，iOS 在关闭自动播放时也只向 JS 发一次保存位置：没有保留待应用的位置。之后点击播放走 `playTrack(... startPosition: nil)`，不会把保存位置应用到 AVPlayerItem。
- iOS 周期位置回调只发事件，没有 Android 每 5 秒落盘的机制；播放中进程意外终止时，保存位置可能明显落后。

证据：`packages/orpheus/ios/GeneralStorage.swift:67`；`OrpheusPlayerManager.swift:357,586,870`；`apps/mobile/src/hooks/stores/playbackContextStore.ts:60`；Android `service/OrpheusMusicService.kt:91,455` 与 `util/TrackResumeStorage.kt`。

### P1：随机队列和队列变更通知不一致

**状态：真机通过。** 随机时 `getQueue()`、`skipTo`、`removeTrack`、`moveTrack` 都按实际播放顺序。所有队列变更都发 `onQueueChanged`。“下一首播放”对已有曲目改为移动，`startFromId` 只匹配本次新增的曲目。另修复审计未列出的两点：随机时起播曲目排在最前，向空队列追加后有当前曲目。

- Android `getQueue()` 返回随机播放的实际遍历顺序，`skipTo/removeTrack/moveTrack` 按该顺序解释索引。
- iOS `getQueue()` 返回 backingQueue 原始顺序，内部另用 shuffleIndices 决定下一首；队列 UI 无法看到真实的接下来播放顺序。
- iOS 的 `setQueue/addToEnd/addToNext/clearQueue/setExecuteShuffleMode` 没有发 `onQueueChanged`；只在删除、移动、反转等少数路径发出。
- 应用的 `usePlayerQueueStore` 和播放上下文同步直接依赖此事件，因此会存在队列未及时刷新的路径。
- Android “下一首播放”会查找已有项并移动；iOS `insertNext` 直接插入，重复点选会制造重复项，当前歌曲也可能被重复插入。
- iOS 追加队列时 `startFromId` 在整个旧新合并队列里查找，Android 仅匹配本次新增项，重复 ID 情况下选择可能不同。

证据：`packages/orpheus/ios/OrpheusQueueManager.swift:12,153,237`；`OrpheusPlayerManager.swift:254,297,318,323,343`；Android `ExpoOrpheusModule.kt:526,658,675,689,751,785`；`apps/mobile/src/hooks/stores/usePlayerQueueStore.ts:36`。

### P1：曲目生命周期事件可能影响听歌记录

**状态：真机通过。** 结算改为按播放器实际载入的曲目进行，替换队列、删除当前曲目、清空队列都会先结算旧曲目，且只结算一次。单曲自然循环会补发 repeat 类型的 `onTrackStarted`。

- iOS 单曲自然循环只 seek 回开头，不补发 Android 的 repeat 类型 `onTrackStarted`。
- 替换整个队列时，iOS 先 `setQueue()`，再在 `playTrack()` 内读取“旧曲目”发送 finished；此时读到的已经是新队列的当前项，可能将旧播放位置/时长算给新歌曲。
- 删除当前歌曲也存在先修改队列再通过 `playTrack` 发送 finished 的顺序问题。
- `clearQueue()` 直接清空并停播，没有在清空前结算旧曲目的对应事件路径。
- 这些事件被 `PlayerSideEffects` 用于写入听歌记录，因此不只是事件命名差异。

证据：`packages/orpheus/ios/OrpheusPlayerManager.swift:208,254,269,297,418`；`apps/mobile/src/lib/player/PlayerSideEffects.ts:77`；Android `OrpheusMusicService.kt:606,659`。

### P1：视频启动皮肤存在直接抛错的路径

**状态：真机通过（不再崩溃）。** iOS 上组件不再抛错，隐藏视频预览和选择入口，启动时用海报代替。视频启动页本身没有移植。

- Android 有原生 `BootSplashVideoView`。
- iOS 没有此 View，TS 包装组件在非 Android 渲染时直接 throw。
- 启动页和主题预览页按是否配置 video 决定渲染，没有 iOS 防护或替代播放器。
- 选择含视频的启动皮肤或打开其视频预览时会走到该错误路径；静态封面/默认启动页不受此路径影响。

证据：`packages/native/src/BootSplashVideoView.tsx:40`；`apps/mobile/src/components/AnimatedBootSplash.tsx:187`；`apps/mobile/src/features/theme/ThemeSection.tsx:967`。

### P2：响度均衡只是保存设置，没有执行

**状态：真机通过。** 按 Android 的规则，只把高于 -14 LUFS 的曲目压低。备份里的响度数据也能导入导出，已下载的曲目同样生效。

- Android 解析 B 站 volume 数据，保存 measuredI 并应用增益。
- iOS 保存 `isLoudnessNormalizationEnabled`，但 BilibiliApi 没有 volume 模型，播放器也没有相应增益逻辑。
- `exportData()` 中 loudness 永远为空，`importData()` 忽略 loudness。
- 用户能切换设置，但实际没有 Android 的响度均衡效果。

证据：`packages/orpheus/ios/ExpoOrpheusModule.swift:101,352,359`；`GeneralStorage.swift:44`；Android `util/DownloadUtil.kt:146`、`service/OrpheusMusicService.kt:839`。

## Orpheus 其他差异

| 能力                | Android                                        | iOS 当前实现 / 影响                                                                                          | 建议                                                          | 状态                                                                                                      |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 在线播放 LRU 缓存   | 有完整缓存、查询、清理                         | `clearPlaybackCache` 空实现，`getLruCachedUris` 永远 `[]`                                                    | 产品能力缺失，可按需补                                        | 未处理                                                                                                    |
| 离线封面            | 下载封面、补齐缺失封面、查询本地 URI           | `getDownloadedCoverUri` 返回 nil，`downloadMissingCovers` 返回 0                                             | 补齐离线体验                                                  | 真机通过                                                                                                  |
| 下载音频导出        | 目录选择、命名、歌词/封面嵌入等                | `exportDownloads` 抛错；目录选择不可用；UI 明确提示仅 Android                                                | 补 iOS Files/分享导出路径，不照搬 SAF                         | 无需处理（iOS 上导出用处不大）                                                                            |
| 下载的镜像/失败恢复 | BilibiliResolver + fallback 数据源等           | 下载只取 `stream.urls.first`，没有播放器已有的镜像切换/过期重取；重试重新创建任务，未使用 resumeData         | 弱网/中断下载专项验证后补齐                                   | 部分修复（已能换镜像，断点续传未做）                                                                      |
| 后台下载            | Media3 前台下载服务                            | 已有 background URLSession 和重连任务逻辑，并非没有后台下载                                                  | 系统结束进程后完成回调/任务恢复需真机验证                     | 待验证（前台下载已真机通过）                                                                              |
| 下载事件契约        | `DownloadTask` 含 track                        | iOS 模块转发时仅含 id/state/进度/字节数，遗漏 track；查询接口仍返回 track                                    | 统一事件载荷                                                  | 已修复                                                                                                    |
| 同步/异步 API       | 下载、循环、随机、睡眠计时等多为 AsyncFunction | iOS 多个同名接口是 Function，而 TS 声明 Promise；现有大量 await 可兼容，但直接 `.then/.catch` 不能按契约依赖 | 统一导出契约，避免 JS 线程承担磁盘/队列操作                   | 真机通过                                                                                                  |
| 音质参数            | 支持 quality、Dolby、Hi-Res 请求参数与响应     | iOS 只取 dash.audio 最大 id，不读取 quality/dolby/hires；响应也没有 Dolby/FLAC 模型                          | 库能力缺失；当前应用 URI 固定 hires=0/dolby=0，影响暂不应夸大 | 未处理                                                                                                    |
| WBI 密钥更新        | 按天刷新                                       | iOS 仅在 key 为 nil 时获取，wbiKeysUpdatedAt 声明但未使用                                                    | 长时运行后签名失效风险需处理                                  | 真机通过（iPad 上同一进程跨过零点后重新获取，之后整夜正常播放；当晚 B 站未更换密钥）                      |
| 上一曲              | Android 桥接直接 previousMediaItem             | iOS 播放超过 3 秒先归零                                                                                      | 明确产品语义，再统一                                          | 未处理                                                                                                    |
| 中断恢复            | Media3 音频焦点管理                            | iOS 有 interruption 处理，但没有保存“中断前是否播放”；收到 shouldResume 直接 play                            | 暂停后中断的恢复行为需验证                                    | 真机通过（Siri 播放中恢复、暂停后保持暂停；暂停时来电或闹钟结束后保持暂停）；定时在中断期间到点后保持暂停 |
| 拔耳机暂停          | 显式 setHandleAudioBecomingNoisy(true)         | 没有自研 routeChange 监听；不能仅凭缺监听断言 AVPlayer 绝不会自动暂停                                        | 真机有线/蓝牙专项验证                                         | 真机通过（拔耳机自动暂停；蓝牙断连未单独确认）                                                            |
| 睡眠定时器          | 主线程 Handler、非正数取消、单调时钟           | Timer.scheduledTimer，没有显式调度到固定 run loop；非正数未按 Android 取消，查询也不判断过期                 | 边界已不一致；后台触发和线程问题需测试确认                    | 真机通过                                                                                                  |
| 频谱                | Android Visualizer；错误时关闭并发错误事件     | 有 MTAudioProcessingTap + FFT；开启频谱后新 B 站解析改走 MP4；tap 失败返回 nil，没有同等错误降级事件         | 不能标为未实现；补运行态切换/失败处理验收                     | 未处理                                                                                                    |
| 当前时间/时长       | Android 将未知时长转换为 0                     | iOS 多处直接输出 CMTime.seconds，没有统一过滤 NaN；Now Playing 元数据反而做了保护                            | 统一有效值契约                                                | 已修复                                                                                                    |
| 错误信息            | code、根因、堆栈等结构化数据                   | iOS 只有 error 字符串；JS getPlayerErrorInfo 的 rawMessage 没读 event.error，且部分 API 错误丢失 B 站 code   | 修复错误透传和用户提示                                        | 真机通过                                                                                                  |
| 系统媒体控制        | MediaSession、媒体按键等                       | 已实现音频 session、Now Playing 标题/歌手/封面/进度、播放暂停/上下首/seek                                    | 不应列为未实现；当前模拟器不适合验收，需真机                  | 真机通过（锁屏播放暂停、上下首、拖动进度、封面）                                                          |
| 系统封面开关        | 属性改变会刷新媒体信息                         | iOS 保存该属性，但 updateNowPlayingInfo 不读它；目前应用也只在 Android 下设置                                | 库语义未对齐，当前入口影响较小                                | 未处理                                                                                                    |
| Headless 事件       | 原生服务可启动 Headless JS                     | iOS 通过普通模块事件桥接到同一回调，仅在 JS 存活时有此路径                                                   | 不能照搬 Android 服务；后台记录可靠性需专门验收               | 待验证                                                                                                    |

关键证据：

- 空实现与导出：`packages/orpheus/ios/ExpoOrpheusModule.swift:325-363`。
- 下载：`packages/orpheus/ios/OrpheusDownloadManager.swift:21,98,127,174,303,432`；事件转发 `ExpoOrpheusModule.swift:28`。
- 音质、签名：`packages/orpheus/ios/BilibiliApi.swift:235,273`；Android `bilibili/BilibiliRepository.kt:62`；应用 `apps/mobile/src/utils/player.ts:179`。
- 系统音频和时间：`packages/orpheus/ios/OrpheusPlayerManager.swift:394,586,626,647,666,715,810,828`。
- 频谱：`packages/orpheus/ios/AudioSpectrumAnalyzer.swift:29`、`OrpheusPlayerManager.swift:483`。
- 错误 UI：`apps/mobile/src/lib/player/PlayerSideEffects.ts:109`。
- Headless：`packages/orpheus/src/headless.ts:17`。

## 另外三个库

### @bbplayer/native

| 能力                               | iOS 现状                                                            | 评价                                                                                  | 状态                             |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| 存储分类统计、私有目录浏览         | 没有 iOS 原生实现；存储页面通过 isAndroid 禁用统计                  | 可补的产品缺失，不是 iOS 系统做不到                                                   | 无需处理（iOS 系统设置里可以看） |
| 运行缓存清理                       | 非 Android 包装函数直接 return；图片缓存另由 expo-image 清理        | 不能把“已清空图片缓存”等同于清空所有原生缓存                                          | 未处理                           |
| ZIP 解压                           | 原生 unzipAsync 没有 iOS 版本                                       | 原生 API 缺失；当前备份导入使用 JSZip，没有因此整体失效；未发现应用直接调用此原生方法 | 无需处理                         |
| 备份导出                           | 原生 Downloads 导出没有移植，但 iOS 页面已经使用 Sharing.shareAsync | 已有平台替代，不列为备份导出缺失                                                      | 无需处理                         |
| 视频启动页                         | 见上方 P1                                                           | 要补播放器或限制入口                                                                  | 真机通过（不再崩溃）             |
| APK 签名/ABI/未知来源授权/安装 APK | 无 iOS 对应实现                                                     | Android 专属，不以同名 API 移植为目标                                                 | 无需处理                         |
| TV 焦点范围/焦点环                 | iOS 降级普通 View / 无操作                                          | 手机 iOS 不应按 Android TV 标准判缺陷；若支持 tvOS 需单独立项                         | 无需处理                         |

证据：`packages/native/expo-module.config.json`；`packages/native/src/BBPlayerNativeModule.ts`；`apps/mobile/src/app/settings/storage.tsx:62,89`；`apps/mobile/src/app/settings/backup.tsx:124`。

### expo-wavy-slider

**状态：部分修复。** 基础拖动和章节刻度已真机通过。波形动画（波长、波高、流速、方向和出现时的铺开）、波形和轨道线宽、滑块两侧空隙和轨道末端圆点已用 Skia 实现，iPhone 实测正常。皮肤滑块图片（含拖动方向、大小和偏移）也已实现，但没有专门换皮肤实测。缓冲段、拖动范围限制、thumbShape 和 incremental 仍未实现。

`WavySlider.ios.ts` 直接导出 `PlainSlider`。它实现基本进度、min/max、拖动、enabled 和 worklet 回调，但没有消费以下 Android 参数：

- bufferedValue / bufferedProgress：没有缓冲段。
- chapterMarkers：没有章节刻度。 状态：真机通过。
- lowerLimit / upperLimit：没有额外的可拖动范围限制。
- waveLength / waveHeight / waveVelocity / waveDirection / incremental：没有波形动画。 状态：除 incremental 外已用 Skia 实现，iPhone 实测正常。
- thumbShape / thumbImageUri / 拖动方向皮肤图片 / 大小偏移：没有皮肤滑块。 状态：除 thumbShape 外已实现，没有专门换皮肤实测。
- waveThickness / trackThickness：轨道尺寸固定。 状态：已实现，iPhone 实测正常。
- 原生 ObservableState：iOS progress 仅识别 Reanimated SharedValue，未实现 Android 原生共享对象路径。
- 交互依赖 RN responder / JS，再派发回调到 UI runtime；不是 Android Compose 原生交互链路。实际流畅度需测量，不能静态断言一定卡顿。

建议：基础滑动可作为首版回退，缓冲段、章节刻度、拖动范围比装饰波形优先。

证据：`packages/expo-wavy-slider/src/WavySlider.ios.ts:1`、`PlainSlider.tsx:18,23`、`ExpoWavySliderModule.ts:18`；Android `ExpoWavySliderModule.kt:73`。

### @bbplayer/image-theme-colors

**状态：未处理。** 不影响 iOS 首版。

- 双端都实现 URL / 对应平台 SharedRef 输入与同样的调色板字段，不属于空壳。
- Android dominant 使用 Palette.dominantSwatch；iOS 用 Vibrant 或 Muted 代替，不能保证是主色，甚至会漏掉只有其他色板有效的情况。
- Android 宽高为 Bitmap 像素；iOS 返回 UIImage.size 的点单位，未乘 scale，与 TS 标注 px 不一致。
- 调色板算法本身不同；不能承诺同图双端颜色完全一致，是否必须一致属于产品选择。

证据：`packages/image-theme-colors/ios/ExpoImageThemeColorsModule.swift:54,72,74`；Android `ExpoImageThemeColorsModule.kt:89`；`src/ExpoImageThemeColors.types.ts:36`。

## 应保留为平台差异的能力

**状态：无需处理。** 灵动岛歌词和 CarPlay 决定不做。

Android 桌面悬浮歌词、SuperLyric / Lyricon / 魅族状态栏歌词、Android 车机歌词消费者在 iOS 为固定 false / unsupported。不能简单视为漏写几段 Swift；如果要提供 iOS 锁屏歌词、Live Activity 或 CarPlay，需要各自定义需求和实现，不等于直接移植 Android overlay。

APK 安装、SAF tree URI、Android TV 焦点实现同理。iOS 的系统媒体控制已经存在，不能因模拟器控制中心为空就判定缺失。

## 建议顺序与验收

1. **先修正确性**：队列事件/随机队列/去重，听歌记录归属，普通续播，视频皮肤错误入口。 状态：真机通过。
2. **补核心体验**：播客逐首续播、响度均衡、下载导出/离线封面。 状态：播客逐首续播、响度均衡和离线封面真机通过，下载导出无需处理。
3. **补契约和健壮性**：错误透传、同步异步统一、定时器、下载重试/恢复、频谱失败处理。 状态：定时器、错误透传和同步异步真机通过，下载已能换镜像，下载断点续传和频谱失败处理未处理。
4. **再补体验一致性**：缓冲轨道/章节刻度/滑块皮肤、主色语义、存储统计、在线缓存。 状态：章节刻度真机通过，滑块皮肤已实现（没有专门换皮肤实测），存储统计无需处理，其余未处理。
5. **真机验收**：锁屏/控制中心/耳机按键，来电中断、耳机断连、后台连续切歌、后台下载与恢复、锁屏定时暂停。静态有实现与真机可靠运行是两个结论。 状态：锁屏控制、拔耳机、Siri 和暂停时来电或闹钟已真机通过，其余待验证。

建议先固定四条回归路径：随机队列的显示与增删移动；播客跨曲续播和冷启动手动恢复；替换/删除/清空队列后的听歌记录；含视频皮肤的选择、预览与重启。 状态：四条路径均已真机通过。
