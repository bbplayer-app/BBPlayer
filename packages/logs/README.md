# @bbplayer/logs

为 React Native 和 Expo 优化的高性能日志管理库。

## 简介

这是 `react-native-logs` 的一个分支版本，专门针对 BBPlayer 的需求进行了定制，特别是增加了对 `expo-file-system` **next** API 的支持，确保在现代 Expo 环境下拥有更佳的日志持久化性能。

## 功能特性

- **多端支持**：兼容 React Native (Bare/Managed)、Expo 以及 Web。
- **自定义传输**：支持控制台色彩输出、异步文件写入、Sentry 集成等。
- **高性能**：支持异步日志记录，最小化对 UI 渲染线程的影响。
- **命名空间**：支持建立不同的 Log 实例，便于模块化开发和调试。

## 安装

```bash
pnpm add @bbplayer/logs
```

## 快速上手

```typescript
import { logger } from '@bbplayer/logs'

const log = logger.createLogger()

log.debug('这是一条调试信息')
log.info('这是一条普通信息')
log.error('这是一条错误信息')
```

## 配置

你可以根据需要自定义日志级别、日期格式以及传输方式：

| 参数      | 类型     | 说明             | 默认值             |
| :-------- | :------- | :--------------- | :----------------- |
| severity  | string   | 最低记录级别     | `debug`            |
| transport | function | 日志传输函数     | `consoleTransport` |
| async     | boolean  | 是否开启异步记录 | `false`            |
| printDate | boolean  | 是否打印日期时间 | `true`             |
