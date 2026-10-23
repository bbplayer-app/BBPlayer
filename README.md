# BBPlayer-macOS

基于 SwiftUI / AppKit 的原生 macOS 音乐播放器，支持 Bilibili 音频播放、歌词、弹幕、歌单和离线下载。

- 原生应用代码、构建和使用说明：[apps/macos/README.md](apps/macos/README.md)
- 实现与后续需求记录：[apps/macos/IMPLEMENTATION.md](apps/macos/IMPLEMENTATION.md)
- 验证结果及已知限制：[apps/macos/VALIDATION.md](apps/macos/VALIDATION.md)

## 开发方式

在此仓库根目录执行：

```sh
swift test --package-path apps/macos
apps/macos/scripts/build-app.sh release
```

生成的应用位于 `apps/macos/build/BBPlayer.app`。此项目采用本机构建；GitHub Actions 自动化停用。

## 项目范围与来源

仓库中保留的手机端、后端等目录属于继承的源文件，不参与 macOS 构建或发布。

本项目基于 [bbplayer-app/BBPlayer](https://github.com/bbplayer-app/BBPlayer) 开发，保留已有许可证、来源说明和历史。许可证见 [LICENSE](LICENSE)，macOS 组件的第三方声明见 [THIRD_PARTY_NOTICES.md](apps/macos/THIRD_PARTY_NOTICES.md)。
