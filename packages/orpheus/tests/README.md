# AB 循环回归验证

## AB 区间编辑器（2026-10-05）

设置窗口现已支持 A/B 双滑块、±0.5 秒微调、独立播放进度、播放/暂停和循环试听。B 点修改不再自动保存；关闭或进入后台恢复正式循环，同曲目草稿只保留在内存中，切歌、保存或清除时丢弃。

`setAbLoopPreview(trackId, range | null)` 仅覆盖运行时状态，`null` 暂停循环；`clearAbLoopPreview(trackId)` 恢复已保存设置。Android 和 iOS 不把试听区间写入恢复存储。`seekToForTrack` 在原生主线程核对曲目后定位，避免切歌后迟到的 seek 影响新音频。这些新增接口需要重建原生应用，不能只发布 JS bundle。

当前可执行回归为 36 个 JS / SQLite 用例，涵盖草稿生命周期、关闭与后台恢复、试听不持久化、保存失败、重复提交、切歌竞态、晚到或缩短的时长及迟到的 seek；实际播放统计另有 12 个 Kotlin 用例。TSX 测试执行真实编辑器与协调层，但不验证设备手势或屏幕布局。

根目录 `pnpm type-check` 与 `pnpm lint` 已通过；`:bbplayer-orpheus:build` 通过，原生 Lint 为 0 个错误、5 个原有警告。2026-10-06 已完成 `:app:assembleRelease`，生成包含 Hermes 字节码、关闭 OTA 的独立 APK，并在 Android 真机覆盖安装；系统包信息确认没有 `DEBUGGABLE` 标记。Metro 停止后应用界面正常加载，用户接手手动检查并反馈成功。该反馈没有逐项测试记录，不代表下方所有边界用例均已验证。iOS 源码同步实现，但尚未编译或实测。

APK、数据库备份和构建日志保存在本机 `.tmp/release-qa-evidence/`，不提交到 Git。未完成的设备录制归档到 `.tmp/validation-flows/`，不能作为自动回归通过证明；JVM 崩溃日志归档到 `.tmp/diagnostics/`。可复用的 JS / SQLite 与 Kotlin 测试源码保留在仓库中。

实机验收应检查：拖动 A/B、短区间端点可分别操作、普通定位退出试听、暂停状态下设置循环不自动播放、关闭重开保留草稿、后台恢复正式区间、保存后重启恢复、清除后恢复普通播放，以及大字体与窄屏下操作区可见。以设备实际观察为准；安装或启动成功不代表这些项目已经通过。

所有命令从仓库根目录执行。

## 可执行回归

```bash
node --test apps/mobile/tests/ab-loop.test.mjs
kotlinc packages/orpheus/android/src/main/java/expo/modules/orpheus/util/PlaybackHistoryTracker.kt packages/orpheus/tests/PlaybackHistoryTrackerTest.kt -include-runtime -d .tmp/ab-loop-history-tests.jar
java -jar .tmp/ab-loop-history-tests.jar
pnpm type-check
pnpm lint
git diff --check
```

Kotlin 命令需要 JDK、kotlinc 和已创建的 `.tmp` 目录。JS 用例需要 Node 24 或支持 `node:sqlite` 的版本，以及已安装的仓库依赖。JS 测试加载真实 TS / TSX 处理器，并以 mock 验证竞态和弹窗生命周期；SQLite 测试执行注册的 24 个迁移和真实 TrackService 查询。Kotlin 用例直接编译原生统计类。它们不验证实际设备布局或 Media3 / AVPlayer 回调时序。

Android 构建需要 `JAVA_HOME` 指向 JDK 21、`ANDROID_HOME` 指向 Android SDK。只指定 Orpheus 包，Gradle 会构建必要依赖：

```bash
export JAVA_HOME='/path/to/jdk-21'
export ANDROID_HOME='/path/to/android-sdk'
pnpm install --frozen-lockfile
pnpm --filter @bbplayer/mobile exec expo prebuild --platform android --no-install
./apps/mobile/android/gradlew -p apps/mobile/android :bbplayer-orpheus:build -PreactNativeArchitectures=arm64-v8a --console=plain
```

把 `JAVA_HOME` 替换为本机 JDK 21 安装目录。Android SDK 需要安装宿主使用的 SDK / Build Tools、NDK 和 CMake；具体版本由生成的 Gradle 工程确定。Android Studio 自带的 JBR 不一定是 JDK 21，不应直接假定可用。

安装到 Android 手机时可构建内置 JS 的本地验证包：

```bash
export APP_VARIANT='production'
export ABI_FILTERS='arm64-v8a'
export BBPLAYER_DISABLE_UPDATES='1'
export SENTRY_DISABLE_AUTO_UPLOAD='true'
pnpm --filter @bbplayer/mobile exec expo prebuild --platform android --no-install
./apps/mobile/android/gradlew -p apps/mobile/android :app:assembleRelease --no-parallel --max-workers=2 --console=plain
```

这些命令沿用上面的 JDK / SDK 环境。包名为 `com.roitium.bbplayer`；生成宿主的本地 Release 构建使用测试签名，不能作为官方发布签名。`BBPLAYER_DISABLE_UPDATES=1` 让此验证包始终使用内置 JS，防止在线更新覆盖待验证的代码；未设置此变量时仍启用在线更新。Sentry 自动上传在本地验证构建中关闭。

本分支已移除 Sentry、Boost、Worklets 的兼容补丁及平台专用构建适配。上述历史验证结果不能作为移除后的构建验证结果。

Orpheus 的 `lint.abortOnError` 已设为 `true`，Lint 错误会阻止构建。当前 Gradle 单元测试任务显示 `NO-SOURCE`；上面的 12 个 Kotlin 统计用例独立于 Gradle 执行，不能将 `build` 成功解释为已运行这些用例或设备测试。

## 需要重建应用后的设备验证

Android 已完成独立 Release APK 的真机安装与用户手动检查。下列边界项目仍需各自的设备证据，不能由一次“成功”反馈、mock 或统计类测试替代；iOS 编译和 AVPlayer 检查需要 macOS / Xcode。

- 60–90 秒区间在 61 秒切歌：仅一条未完成记录，时长约 1 秒。在 85 秒切歌：Bilibili 的请求进度为 85。
- 元数据为 180 秒、实际音频为 180.4 秒时保存 B=180.4。切歌后在音源加载完成前恢复设置，确认不会按整数元数据拒绝区间，加载完成后仍在 B 点循环；冷启动恢复也应如此。若实际音频只有 180.2 秒，加载完成后应停用该区间；已知实际时长时设置 B=180.4 仍应被拒绝。Android 与 iOS 均需验证，iOS 还需覆盖试听区间的同一校验路径。
- 连续播放多轮，刚回到 A 就切歌：仅一条记录，累计多轮秒数，完成状态保持。期间暂停、缓冲、倍速、手动 seek、修改或清除循环，核对累计秒数与本轮完成状态。
- Android 的 B 点在曲尾前 50 毫秒，以及 B 等于曲尾：队列最后一首、普通队列中间曲目、OFF / TRACK / QUEUE 重复模式下均回到 A。用户暂停或定时暂停后不自动继续，清除 AB 恢复原末尾暂停设置，手动切歌不被内部 seek 标记吞掉。
- iOS 核对边界观察器在清除和切歌时移除；边界与曲尾回调同时到达时只循环，不产生历史记录。真正离开时只产生一条记录。连续 seek 的旧完成回调不能恢复新 seek 或已暂停播放。
- 弹窗停留期间切歌并返回旧曲目，A 草稿重新初始化；重复点 B 只提交一次；旧保存结果不关闭当前弹窗。冷启动恢复非第 0 首时，只应用最终曲目的循环，暂停恢复后首次播放不生成额外历史记录。

历史表结构未变，旧记录不回填；原生事件中的 `playbackSummary` 为可选字段。完整修复必须重建原生应用，不能只更新 JS bundle。
