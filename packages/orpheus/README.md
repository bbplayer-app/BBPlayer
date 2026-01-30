# Orpheus

**BBPlayer 内部音频模块**

这是一个为 BBPlayer 项目构建的高性能定制音频播放库。旨在替代 `react-native-track-player`，以提供与 Android Media3 (ExoPlayer) 更紧密的集成，并针对 Bilibili 音频流逻辑提供了原生层支持。

## 功能特性

- **Bilibili 集成**: 自动处理 Bilibili 音频流，支持高码率（需 Cookie）。
- **双层缓存**: 包含独立的下载缓存和边下边播 LRU 缓存。
- **Android Media3**: 基于最新的 Media3 和 ExoPlayer 架构。
- **桌面歌词**: 支持系统级桌面歌词悬浮窗。
- **ExoPlayer 扩展**: 支持 `ffmpeg` 扩展（如需要）。

## 文档

详细的 API 文档和使用说明请参阅 [Wiki](docs/Home.md) 或直接查看 `docs/` 目录。

## 声明

该库主要供 BBPlayer 内部使用，虽然开源，但可能不会处理外部的 Feature Request。
