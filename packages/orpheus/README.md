# @bbplayer/orpheus

BBPlayer 高性能核心音频播放模块。

## 简介

这是一个为 BBPlayer 项目定制的音频播放库，旨在替代第三方库以提供与 Android Media3 (ExoPlayer) 和 AVFoundation 更紧密的集成，并针对 Bilibili 音频流逻辑提供原生层支持。

## 功能特性

- **Bilibili 集成**：自动处理 Bilibili 音频流协议，支持高码率解析。
- **双层缓存机制**：包含独立的下载缓存和边下边播 LRU 缓存。
- **Android Media3**：基于最新的 Media3 架构，提供更好的稳定性。
- **桌面歌词支持**：实现系统级桌面歌词悬浮窗的原生支持。
- **高性能**：针对移动端性能优化的零拷贝提取与流处理。

## 文档

详细的 API 文档和使用说明请参阅目录下的 [docs](./docs) 文件夹。

## 声明

该库主要供 BBPlayer 内部使用。虽然代码开源，但我们主要关注满足 BBPlayer 的功能需求。
