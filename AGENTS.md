# BBPlayer

BBPlayer 是一个基于 React Native 开发的 BiliBili 流媒体音乐软件，整个仓库为 monorepo

## 命令

```bash
pnpm install                   # Only pnpm — npm/yarn breaks workspace resolution
pnpm lint                      # oxlint + eslint
pnpm lint:fix                  # Auto-fix
pnpm format                    # oxfmt
pnpm tsgo --noEmit             # TypeScript type checking
```

## 最佳实践

### 运行检查和构建

如果任务涉及 TypeScript / JavaScript，你应当在每个任务完成后都运行一次 `pnpm tsgo --noEmit` 与 `pnpm lint`，检查是否引入了新的错误。

如果任务涉及原生代码，你应当在每个任务完成后**只对那个包**运行一次 `gradlew build`，并检查是否有构建错误。

### 搜索文件和 symbol

我们推荐使用 codedb mcp 搜索，而非使用 grep 手动搜索

## 仓库结构

### /apps

- mobile - React Native 移动应用（技术栈：Expo + Drizzle ORM + Material Design 3 + Zustand + TanStack Query）
- backend - 后端服务，主要提供歌单共享与软件更新查询（技术栈：Hono + ArkType + Drizzle ORM + CloudFlare Worker）
- docs - VuePress 文档网站
- update-publisher - 用于发布更新的工具

### /packages

- bottom-tabs-react-navigation — React Native 原生底部标签栏与 React Navigation 的桥接适配层
- eslint-plugin — 项目自定义 ESLint 规则集合
- expo-wavy-slider — Android 原生波形滑动条（Jetpack Compose）的 Expo 模块封装
- heatmap — 基于 SVG 的日期热力图组件
- image-theme-colors — 从图片中提取主题色的 Expo 原生模块
- logs — React Native 日志库
- native — BBPlayer 原生能力集成模块
- orpheus — BBPlayer 核心音频播放引擎
- react-native-bottom-tabs — 跨平台原生底部标签栏组件
- splash — 歌词转换与解析库
