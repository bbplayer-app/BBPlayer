# Changelog

项目的所有显著更改都将记录在这个文件中。

项目的 CHANGELOG 格式符合 [Keep a Changelog]，
且版本号遵循 [Semantic Versioning]。 ~~(然而，事实上遵循的是 [Pride Versioning])~~

## [UNRELEASED]

### Added

- 支持酷狗音乐的歌词搜索
- 支持从 QQ 音乐 / 网易云音乐导入歌单并匹配 b 站视频
- 为关键 UI 组件添加 `testID` 以支持 Maestro E2E 测试
- 懒加载的模态框在加载时显示 `ActivityIndicator`
- 优化数据库迁移检查，通过缓存 schema 版本跳过无新迁移时的 SQL 查询
- 支持双击播放列表顶部回到顶端
- 实现播放器页面滑动时标题的平滑渐变效果
- 播放列表页面背景使用封面主题色

### Changed

- 移除 trackService 中的标题重复检查
- orpheus 库从 Cronet 切换到 OkHttp 作为 Media3 的网络库
- 启用 R8 混淆
- 关闭全局 `cleartextTrafficPermitted`，只允许 `hdslb.com` 使用 http
- 移除 reanimated 的 Static Flags
- 重构 RootLayout 的 SplashScreen 显示逻辑
- 试图增强播放器的后台留存能力

### Fixed

- 修复 `reportErrorToSentry` 上报非 Error 类型错误时显示为 `[object Object]` 的问题
- 修复 `DonationQRModal` 在部分 Android 设备上因 `expo-media-library` 导入方式错误导致崩溃的问题
- 修复歌词搜索失败时错误地使用 `FileSystemError` 类型导致被上报到 Sentry 的问题
- 修复 `ToastContext` 未初始化导致应用崩溃的问题
- 修复因 cookie 键名包含无效字符（如换行符）导致的应用崩溃，并增加自动修复提示

## [2.2.4] - 2026-01-30

### Added

- 显示频谱功能

### Changed

- 改为 monorepo
- 将 TypeScript 及相关依赖统一管理到 root package.json
- 使用 `@nandorojo/galeria` 替代 `react-native-awesome-gallery`
- 使用 `react-native-fast-squircle` 替换主要 UI 元素的圆角矩形为 squircle
- 统一列表项的设计风格（尺寸、圆角）
- 将 `apps/bbplayer` 重命名为 `apps/mobile`

### Fixed

- 修复搜索播放列表时，错误地过滤了远程播放列表的问题
- 修复播放器页面 ANR 问题

## [2.2.3] - 2026-01-28

### Added

- 集成 commitlint 和 lefthook 以规范 commit 信息
- 同步本地歌单到 b 站收藏夹（不稳定，容易被风控）
- 收藏夹同步现在会显示详细的进度模态框
- 对 IOS 进行基础的适配
- 使用 useDeferredValue 优化本地播放列表、本地歌单详情页和首页搜索的输入响应速度
- 使用 useTransition 优化音乐库 Tab 切换体验，减少卡顿感
- 重构播放器 Hooks，使用全局 Zustand Store 管理播放状态，减少 JS 与 Native 之间的通信开销

### Changed

- 重构 `RemoteTrackList` 和 `LocalTrackList` 组件的 Props，将选择相关状态合并为 `selection` 对象，并直接继承 `FlashList` 的 Props以获得更好的灵活性
- 使用 react-native-keyboard-controller 的 API 重构 AnimatedModalOverlay
- 重构 `src/lib/api/bilibili/api.ts` 为 Class
- 修复冷启动时 Deep Link 无法跳转的问题
- 创建/修改歌曲或播放列表时，禁止使用重复的名称
- 将 `app.bbplayer.roitium.com` 作为 Deep Link 的 host
- 关闭 dolby / hires 音源
- 启用 reanimated 的 Static Flags：`ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`、`IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS`、`USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`

## [2.2.2] - 2026-01-25

### Changed

- 重构分享卡片组件，优化预览生成逻辑，并支持带有分 P 参数的分享链接
- 支持播放器页面显示缓冲进度
- 升级到 expo55-beta
- 优化 version code 逻辑，使用 commit 数量作为 version code
- 增加 nightly 构建
- 切换到 sonner-native
- 升级 expo-image-theme-colors 依赖到 0.2.1，支持传入图片 url 提取封面色
- 升级 expo-orpheus 到 0.9.4，支持断开蓝牙时暂停播放

### Added

- prevent progress bar regression & add debounce to PlayButton (Thanks to @longlin10086 #153)
- fix: update PlaySlide info after song's change (Thanks to @longlin10086 #159)
- feat: add PlayControls overlay to LyricPage (Thanks to @longlin10086 #164)

## [2.2.0] - 2026-01-23

### Changed

- 升级依赖

### Added

- 添加本地播放列表搜索功能
- 为播放列表模态框增加遮罩（Thanks to @longlin10086 #146）
- 支持跳转到分 p 视频播放列表时滚动并高亮指定分 p
- 支持分享歌曲、歌词卡片
- 使用 TrueSheet 替换 @gorhom/bottom-sheet
- 部分下拉菜单重构为 bottom sheet 样式，更清晰

## [2.1.9] - 2026-01-22

### Fixed

- BBPLAYER-5N

### Changed

- ci 增加构建 armabi-v7a、x86、x86_64 的工作流
- 使用 React.lazy() 动态导入模态组件并用 Suspense 边界包装渲染

### Added

- 为 Playlist 和 Library 页面增加 Skeleton
- 支持 qq 音乐作为歌词源
- 搜索时高亮搜索结果中的关键字
- 支持播放器页面播放速度调整
- 支持将播放队列保存为播放列表

## [2.1.8] - 2026-01-13

### Added

- 重新设计播放器进度条
- 增加~~讨口子~~捐赠页面
- 桌面歌词
- 通知栏增加切换循环模式按钮
- 尝试启用 dolby / hires 音源

### Changed

- 移除了未使用的依赖

### Fixed

- 修复登录二维码可能为空导致的报错
- 修复部分 bilibili api 返回 data 为 null 导致的报错

## [2.1.6] - 2026-01-06

### Fixed

- 再次尝试修复播放器页面卡顿问题（😭）
- 尝试修复 `cannot use a recycled source in createBitmap` 错误（expo-orpheus@0.7.2）(然而问题依然存在)

### Added

- 新增启动时自动播放功能
- 重构设置页面，增加二级目录，更简洁
- 评论区功能

### Changed

- 升级了 expo 相关依赖库版本

## [2.1.5] - 2025-12-31

### Fixed

- remove unexpected white space above bottom tabs (Thanks to @imoyy #107)
- 修复歌曲播放完成后点击播放，无法重新播放的问题

### Added

- 增加 NowPlayingBar 底部沉浸样式 (Thanks to @imoyy #110)
- 增加 NowPlayingBar 滑动手势操作 (Thanks to @imoyy #110)
- 支持边下边播缓存

## [2.1.4] - 2025-12-20

### Added

- 切换到 Orpheus 音频库，取代 RNTP

### Fixed

- 尝试修复播放器页面卡顿的问题

## [1.4.3] - 2025-12-01

### Added

- 支持实验性响度均衡（默认不启用）
- 支持在软件启动时恢复上次播放进度（默认不启用）

### Fixed

- 修复 `DatabaseLauncher has already started. Create a new instance in order to launch a new version.` 错误

## [1.4.2] - 2025-11-09

### Added

- 完善「稍后再看」页面功能
- 支持多种播放器背景风格——渐变、流光、默认 md3 固定背景
- 支持在「开发者页面」设置热更新渠道
- 增加了一些 Sentry Spans 埋点，试图提高项目可观测性

### Changed

- 优化歌词页面

### Fixed

- 修复合集 ps 过大，导致 api 返回数据错误的问题
- 修复 Cover Placeholder 乱码问题
- 不再尝试使用 dolby/hi-res 音源，避免 `android-failed-runtime-check` 错误

## [1.4.0] - 2025-11-02

### Added

- 清除所有歌词缓存（在「开发者页面」）
- 基于 B 站视频 bgm 识别结果精准搜索歌词
- 切换到 expo-router
- 改进了歌词页面与交互逻辑（灵感来自 Salt Player + Spotify，给前辈们磕头了咚咚咚）
- 可通过播放器页的下拉菜单跳转视频详情页
- 将 B 站「稍后再看」作为播放列表（置顶在「播放列表」页面）

### Fixed

- 一些减少 rerender 次数的优化
- 使用 [react-native-paper/4807](https://github.com/callstack/react-native-paper/issues/4807) 中提到的 Menu 组件修复方法，移除 patch

## [1.3.6] - 2025-10-26

### Added

- 给视频/播放列表封面加了个渐变 placeholder
- 本地播放列表使用基于游标的无限滚动
- 定时关闭功能
- 点击通知可跳转到下载页面

### Fixed

- 对 NowPlayingBar 的 ProgressBar 的颜色和位置进行一点修复，更符合直觉
- 直接在 Sentry.init 中忽略 ExpoHaptics 的错误
- 这次真的修复了模态框错位的问题（确信）

## [1.3.5] - 2025-10-26

### Fixed

- 因图片缓存在内存导致的 OOM
- 部分用户手机不支持振动反馈
- 合集/分 p 同步时与原始顺序不一致
- 修复在导航未初始化完成前尝试打开更新模态框

### Added

- 播放排行榜页面支持点击直接播放，且支持无限滚动查看所有播放记录

### Changed

- 增加了 issue 模板
- 支持构建 preview 版本，并分离了不同版本的包名
- 删除了 gemini-cli 的 workflow

## [1.3.4] - 2025-10-15

### Fixed

- 修复 App Linking 不生效的问题

## [1.3.3] - 2025-10-15

### Added

- 手动检查更新
- 增加 `CHANGELOG.md` 文件

### Changed

- 将所有源代码移入 `src` 目录
- `update.json` 中增加一个 `listed_notes` 字段，用于更清晰展示更新日志

### Fixed

- 修复了强制更新不生效的问题

## [1.3.2] - 2025-10-14

### Added

- 为一部分交互添加了触觉反馈

### Changed

- 修改一部分组件使其符合 React Compiler 规范
- 升级了一些依赖包
- 移除了页面加载时强制显示的 ActivityIndicator

### Fixed

- 修复了更新音频流时抛出的 BilibiliApiError 会被错误上报的问题

<!-- Links -->

[keep a changelog]: https://keepachangelog.com/en/1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
[pride versioning]: https://pridever.org/

<!-- Versions -->

[unreleased]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.4...HEAD
[1.3.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.1...v1.3.2
[1.3.3]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.2...v1.3.3
[1.3.4]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.3...v1.3.4
[1.3.5]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.4...v1.3.5
[1.3.6]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.5...v1.3.6
[1.4.0]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.6...v1.4.0
[1.4.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.0...v1.4.2
[1.4.3]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.2...v1.4.3
[2.1.4]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.3...v2.1.4
[2.1.5]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.4...v2.1.5
[2.1.6]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.5...v2.1.6
[2.1.8]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.6...v2.1.8
[2.1.9]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.8...v2.1.9
[2.2.0]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.9...v2.2.0
[2.2.2]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.0...v2.2.2
[2.2.3]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.2...v2.2.3
[2.2.4]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.3...v2.2.4
