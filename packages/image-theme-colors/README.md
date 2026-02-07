# @bbplayer/image-theme-colors

基于 Expo ImageRef 的高性能图片主题色提取工具。

## 简介

这是一个专门为 BBPlayer 开发的主题色提取模块。它基于 Android Palette 实现，直接传入 Expo 的 `ImageRef` 对象，实现零拷贝提取，极大地提升了在 React Native 环境下处理大尺寸封面的性能。

## 功能特性

- **零拷贝**：直接操作原生内存引用的图片对象，避免了 Base64 转换带来的开销。
- **性能卓越**：针对 Android 设备进行了深度优化。
- **Material 3 适配**：提取的颜色可直接用于生成 Material Design 3 配色方案。

## 安装

```bash
pnpm add @bbplayer/image-theme-colors
```

## 使用说明

本模块由于依赖 `expo-image` 的内部引用，目前主要建议在 BBPlayer 及其关联组件中使用。

```typescript
import { getThemeColors } from '@bbplayer/image-theme-colors'

const colors = await getThemeColors(imageRef)
```
