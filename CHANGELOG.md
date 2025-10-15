# Changelog

项目的所有显著更改都将记录在这个文件中。

项目的 CHANGELOG 格式符合 [Keep a Changelog]，
且版本号遵循 [Semantic Versioning]。 ~~(然而，事实上遵循的是 [Pride Versioning])~~

## [Unreleased]

### Changed

- 将所有源代码移入 `src` 目录
- 增加 `CHANGELOG.md` 文件

## [1.3.2] - 2025-10-14

### Added

- 为一部分交互添加了触觉反馈

### Changed

- 修改一部分组件使其符合 React Compiler 规范
- 升级了一些依赖包
- 移除了页面加载时强制显示的 ActivityIndicator
- 更新音频流时出现的 BilibiliApiError 现在不会上报

<!-- Links -->

[keep a changelog]: https://keepachangelog.com/en/1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
[pride versioning]: https://pridever.org/

<!-- Versions -->

[unreleased]: https://github.com/Author/Repository/compare/v1.3.2...HEAD
[1.3.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.1...v1.3.2
