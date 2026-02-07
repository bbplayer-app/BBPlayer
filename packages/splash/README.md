# @bbplayer/splash

BBPlayer 歌词解析与转换核心工具库。

## 简介

格式基于 [SPL (Salt Player Lyric)](https://bbplayer.roitium.com/SPL)，它是 LRC 格式的高级扩展，旨在支持更丰富的歌词呈现效果。

## 功能特性

- **解析能力**：支持 LRC、SPL 等多种歌词格式的精准解析。
- **转换引擎**：支持将网易云音乐等平台的 YRC/LRC 格式转换为支持逐字进度的 SPL 格式。
- **类型安全**：提供统一、严谨的歌词数据结构定义。
- **高性能**：针对移动端环境优化的解析算法。

## 安装

```bash
pnpm add @bbplayer/splash
```

## 快速上手

```typescript
import { parseLRC } from '@bbplayer/splash'

const lyrics = parseLRC(lrcString)
```
