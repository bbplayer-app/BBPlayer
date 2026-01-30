# 欢迎使用 Orpheus

**BBPlayer 内部音频模块**

Orpheus 是一个为 BBPlayer 构建的高性能音频播放库，基于 Android Media3 (ExoPlayer)。

## 目录

- [API 方法 (Methods)](API-Methods.md)
- [数据类型 (Types)](API-Types.md)
- [事件与后台任务 (Events)](API-Events.md)
- [发版指南 (Releasing)](RELEASING.md)

## 快速开始

Orpheus 主要用于处理复杂的音频播放需求，特别是 Bilibili 音频流和本地缓存管理。

### 核心特性

- **Bilibili 支持**: 如果提供了 Bilibili Cookie，Orpheus 可以自动获取高音质流。
- **缓存系统**: 内置 LRU 缓存（边下边播）和持久化下载管理。
- **桌面歌词**: Android 系统级悬浮窗歌词支持。
