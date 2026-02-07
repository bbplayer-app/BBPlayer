# @bbplayer/splash

BBPlayer 的歌词解析与转换工具库。格式基于 [SPL](https://moriafly.com/standards/spl.html)，可以理解为 LRC 的超集。

## 功能

- **解析**: 支持多种歌词格式的解析。
- **转换**: 提供网易云音乐等平台的歌词格式转换功能，支持将网易云的 YRC/LRC 转换为 SPL（支持逐字歌词）
- **类型定义**: 提供统一的歌词数据结构定义。

## 安装

```bash
pnpm add @bbplayer/splash
```

## 使用

```typescript
import { parseLRC } from '@bbplayer/splash'

const lyrics = parseLRC(lrcString)
```
