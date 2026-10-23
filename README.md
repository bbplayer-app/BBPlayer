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

## 分支与开发

`main` 是默认分支，保留经过相应检查的代码。小范围、低风险修正可直接提交到 `main`；较大功能或有风险的实验使用临时功能分支，验证后在本地合并回 `main`，再删除已合并的分支。分支使用描述功能的名称，例如 `playback-rework`。此流程不要求长期保留 `dev` 或创建 PR。

GitHub Actions 保持关闭，测试和构建在本地进行。已验证范围和待验收项目见 [验证记录](apps/macos/VALIDATION.md)。

## 项目范围与来源

仓库中保留的手机端、后端等目录属于继承的源文件，不参与 macOS 构建或发布。

本项目基于 [bbplayer-app/BBPlayer](https://github.com/bbplayer-app/BBPlayer) 开发，保留已有许可证、来源说明和历史。许可证见 [LICENSE](LICENSE)，macOS 组件的第三方声明见 [THIRD_PARTY_NOTICES.md](apps/macos/THIRD_PARTY_NOTICES.md)。
