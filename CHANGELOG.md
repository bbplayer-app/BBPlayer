# Changelog

项目的所有显著更改都将记录在这个文件中。

项目的 CHANGELOG 格式符合 [Keep a Changelog]，
且版本号遵循 [Semantic Versioning]。 ~~(然而，事实上遵循的是 [Pride Versioning])~~

## [UNRELEASED]

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

[unreleased]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.0...HEAD
[1.3.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.1...v1.3.2
[1.3.3]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.2...v1.3.3
[1.3.4]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.3...v1.3.4
[1.3.5]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.4...v1.3.5
[1.3.6]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.5...v1.3.6
[1.4.0]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.6...v1.4.0
