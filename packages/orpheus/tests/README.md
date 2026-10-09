# AB 循环回归验证

## AB 区间编辑器（2026-10-05）

设置窗口现已支持 A/B 双滑块、±0.5 秒微调、独立播放进度、播放/暂停和循环试听。B 点修改不再自动保存；关闭或进入后台恢复正式循环，同曲目草稿只保留在内存中，切歌、保存或清除时丢弃。

`setAbLoopPreview(trackId, range | null)` 仅覆盖运行时状态，`null` 暂停循环；`clearAbLoopPreview(trackId)` 恢复已保存设置。Android 和 iOS 不把试听区间写入恢复存储。`seekToForTrack` 在原生主线程核对曲目后定位，避免切歌后迟到的 seek 影响新音频。这些新增接口需要重建原生应用，不能只发布 JS bundle。

当前可执行回归为 36 个 JS / SQLite 用例，涵盖草稿生命周期、关闭与后台恢复、试听不持久化、保存失败、重复提交、切歌竞态、晚到或缩短的时长及迟到的 seek；实际播放统计另有 12 个 Kotlin 用例。TSX 测试执行真实编辑器与协调层，但不验证设备手势或屏幕布局。

根目录 `pnpm type-check` 与 `pnpm lint` 已通过；`:bbplayer-orpheus:build` 通过，原生 Lint 为 0 个错误、5 个原有警告。2026-10-06 已完成 `:app:assembleRelease`，生成包含 Hermes 字节码、关闭 OTA 的独立 APK，并在 Android 真机覆盖安装；系统包信息确认没有 `DEBUGGABLE` 标记。Metro 停止后应用界面正常加载，用户接手手动检查并反馈成功。该反馈没有逐项测试记录，不代表下方所有边界用例均已验证。iOS 源码同步实现，当前 Windows 环境未编译或实测。

APK、数据库备份和构建日志保存在本机 `.tmp/release-qa-evidence/`，不提交到 Git。未完成的设备录制归档到 `.tmp/validation-flows/`，不能作为自动回归通过证明；JVM 崩溃日志归档到 `.tmp/diagnostics/`。可复用的 JS / SQLite 与 Kotlin 测试源码保留在仓库中。

Windows APK 构建若遇到 SDK 自带 Ninja 的 `Filename longer than 260 characters`，本次通过本地 Gradle 初始化脚本 `.tmp/ab-editor-build.gradle` 指定已有 `.tmp/ninja-1.12.1/ninja.exe`；未更换 SDK 工具，也未修改生成宿主配置。构建日志位于 `.tmp/ab-editor-apk-build.log`。使用该脚本时给 `-I` 传仓库根目录下的绝对路径，因为 `-p apps/mobile/android` 会改变相对路径的解析基准。

实机验收应检查：拖动 A/B、短区间端点可分别操作、普通定位退出试听、暂停状态下设置循环不自动播放、关闭重开保留草稿、后台恢复正式区间、保存后重启恢复、清除后恢复普通播放，以及大字体与窄屏下操作区可见。以设备实际观察为准；安装或启动成功不代表这些项目已经通过。

所有命令从仓库根目录执行。

## 可执行回归

```powershell
node --test apps/mobile/tests/ab-loop.test.mjs
kotlinc packages/orpheus/android/src/main/java/expo/modules/orpheus/util/PlaybackHistoryTracker.kt packages/orpheus/tests/PlaybackHistoryTrackerTest.kt -include-runtime -d .tmp/ab-loop-history-tests.jar
java -jar .tmp/ab-loop-history-tests.jar
pnpm type-check
pnpm lint
git diff --check
```

Kotlin 命令需要 JDK、kotlinc 和已创建的 `.tmp` 目录。JS 用例需要 Node 24 或支持 `node:sqlite` 的版本，以及已安装的仓库依赖。JS 测试加载真实 TS / TSX 处理器，并以 mock 验证竞态和弹窗生命周期；SQLite 测试执行注册的 24 个迁移和真实 TrackService 查询。Kotlin 用例直接编译原生统计类。它们不验证实际设备布局或 Media3 / AVPlayer 回调时序。

Android 构建需要 `JAVA_HOME` 指向 JDK 21、`ANDROID_HOME` 指向 Android SDK。只指定 Orpheus 包，Gradle 会构建必要依赖：

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
pnpm install --frozen-lockfile
pnpm --filter @bbplayer/mobile exec expo prebuild --platform android --no-install
.\apps\mobile\android\gradlew.bat -p apps/mobile/android :bbplayer-orpheus:build -PreactNativeArchitectures=arm64-v8a --console=plain
```

把 `JAVA_HOME` 替换为本机 JDK 21 安装目录。Android SDK 需要安装宿主使用的 SDK / Build Tools、NDK 和 CMake；具体版本由生成的 Gradle 工程确定。Android Studio 自带的 JBR 不一定是 JDK 21，不应直接假定可用。

`apps/mobile/expo-plugins/withAndroidBuildCompatibility.js` 在 prebuild 时解析 Sentry 脚本并写入相对路径，避免 Windows 上 Gradle 子进程得到空包路径；在 Windows 构建时，将应用及原生依赖的 CMake 中间文件放到仓库 `.tmp` 下的短目录，避免 pnpm / Prefab 路径超过 Ninja 的对象文件路径限制。配置在根插件执行前注册，应用使用 `.tmp/a`，常用依赖使用 `.tmp/w`、`.tmp/e`、`.tmp/s`、`.tmp/r`，其余依赖使用项目路径散列生成的 `.tmp/c/<hash>`。应用执行 CMake 前通过 `normalizeWindowsAutolinking.js` 将 RNRepo 自动链接文件中的 Windows 分隔符改为正斜杠，并为生成的 JNI 源码建立 `.tmp/j/<hash>` 目录链接，以缩短 Ninja 的输入路径。目录链接不需要管理员权限；重新生成宿主会自动恢复这些配置，不需要手动编辑生成文件。

安装到 Android 手机时可构建内置 JS 的本地验证包：

```powershell
$env:APP_VARIANT = 'production'
$env:ABI_FILTERS = 'arm64-v8a'
$env:BBPLAYER_DISABLE_UPDATES = '1'
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
pnpm --filter @bbplayer/mobile exec expo prebuild --platform android --no-install
.\apps\mobile\android\gradlew.bat -p apps/mobile/android :app:assembleRelease --no-parallel --max-workers=2 --console=plain
```

这些命令沿用上面的 JDK / SDK 环境。包名为 `com.roitium.bbplayer`；生成宿主的本地 Release 构建使用测试签名，不能作为官方发布签名。`BBPLAYER_DISABLE_UPDATES=1` 让此验证包始终使用内置 JS，防止在线更新覆盖待验证的代码；未设置此变量时仍启用在线更新。Sentry 自动上传在本地验证构建中关闭。Windows 兼容插件还使用 CMake / Ninja job pools，将应用原生编译并发限制为 2、链接并发限制为 1，避免大量 React Native 预编译头任务同时运行耗尽内存；Gradle worker 限制本身不会限制 Ninja 并发。

`patches/react-native-worklets@0.11.4.patch` 回移植 [上游 PR #10448](https://github.com/software-mansion/react-native-reanimated/pull/10448)，将 Worklets 原有的 `lintVital*` 豁免扩大到该依赖的全部 `lint*` 任务，以绕过 Android Lint 分析 Kotlin Gradle 脚本时的 K2 UAST 崩溃。补丁仅匹配 Worklets 0.11.4；升级依赖时应重新评估并在上游版本包含修复后移除。Orpheus 自身的 Lint、编译与打包检查仍运行，未全局排除 Lint。构建成功不能解释为 Worklets 的 Lint 已通过。

Orpheus 的 `lint.abortOnError` 已设为 `true`，Lint 错误会阻止构建。当前 Gradle 单元测试任务显示 `NO-SOURCE`；上面的 12 个 Kotlin 统计用例独立于 Gradle 执行，不能将 `build` 成功解释为已运行这些用例或设备测试。

2026-10-05 Windows 验证（JDK 21 / Gradle 9.3.1 / arm64-v8a）：

- `pnpm install --frozen-lockfile` 通过，依赖版本及完整性元数据未变化；锁文件更新来自 Worklets 补丁及关联的 peer 快照标识。
- 完整 `:bbplayer-orpheus:build` 通过，耗时 1 分 25 秒。随后执行 `expo prebuild --clean --platform android --no-install`，未手动编辑生成工程，再次完整构建通过，耗时 1 分 51 秒。
- Orpheus Lint 为 0 个错误、5 个警告。警告来自未修改的悬浮歌词、下载导出和歌词视图代码；Worklets 的 `lintAnalyzeDebug` 按兼容补丁显示 `SKIPPED`。
- 根目录 `pnpm type-check`、`pnpm lint`、`git diff --check` 通过；16 个 JS / SQLite 用例通过（包含执行全部 24 个迁移），已有 Kotlin 回归 JAR 的 12 个统计用例再次通过。
- Debug / Release AAR 位于 `packages/orpheus/android/build/outputs/aar/`。本地日志分别为 `.tmp/orpheus-build.log`、`.tmp/orpheus-prebuild-regenerated.log`、`.tmp/orpheus-build-regenerated.log`，Lint 报告位于 `packages/orpheus/android/build/reports/lint-results-debug.html`。

## 需要重建应用后的设备验证

Android 已完成独立 Release APK 的真机安装与用户手动检查。下列边界项目仍需各自的设备证据，不能由一次“成功”反馈、mock 或统计类测试替代；iOS 编译和 AVPlayer 检查需要 macOS / Xcode。

- 60–90 秒区间在 61 秒切歌：仅一条未完成记录，时长约 1 秒。在 85 秒切歌：Bilibili 的请求进度为 85。
- 连续播放多轮，刚回到 A 就切歌：仅一条记录，累计多轮秒数，完成状态保持。期间暂停、缓冲、倍速、手动 seek、修改或清除循环，核对累计秒数与本轮完成状态。
- Android 的 B 点在曲尾前 50 毫秒，以及 B 等于曲尾：队列最后一首、普通队列中间曲目、OFF / TRACK / QUEUE 重复模式下均回到 A。用户暂停或定时暂停后不自动继续，清除 AB 恢复原末尾暂停设置，手动切歌不被内部 seek 标记吞掉。
- iOS 核对边界观察器在清除和切歌时移除；边界与曲尾回调同时到达时只循环，不产生历史记录。真正离开时只产生一条记录。连续 seek 的旧完成回调不能恢复新 seek 或已暂停播放。
- 弹窗停留期间切歌并返回旧曲目，A 草稿重新初始化；重复点 B 只提交一次；旧保存结果不关闭当前弹窗。冷启动恢复非第 0 首时，只应用最终曲目的循环，暂停恢复后首次播放不生成额外历史记录。

历史表结构未变，旧记录不回填；原生事件中的 `playbackSummary` 为可选字段。完整修复必须重建原生应用，不能只更新 JS bundle。
