# Changelog

项目的所有显著更改都将记录在这个文件中。

项目的 CHANGELOG 格式符合 [Keep a Changelog]，
且版本号遵循 [Semantic Versioning]。 ~~(然而，事实上遵循的是 [Pride Versioning])~~

## [Unreleased]

### Fixed

- 因图片缓存在内存导致的 OOM
- 部分用户手机不支持振动反馈
- 合集/分 p 同步时与原始顺序不一致

### Added

- 播放排行榜页面支持点击直接播放，且支持无限滚动查看所有播放记录

### Changed

- 增加了 issue 模板
- 支持构建 preview 版本，并分离了不同版本的包名

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

[unreleased]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.4...HEAD
[1.3.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.1...v1.3.2
[1.3.3]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.2...v1.3.3
[1.3.4]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.3...v1.3.4
