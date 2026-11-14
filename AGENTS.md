# BBPlayer

BBPlayer 是一个基于 React Native 开发的 BiliBili 流媒体音乐软件，整个仓库为 monorepo

## 命令

注意，所有命令都应当在项目根目录运行

```bash
pnpm install                   # Only pnpm — npm/yarn breaks workspace resolution
pnpm lint                      # oxlint
pnpm lint:fix                  # Auto-fix
pnpm format                    # oxfmt
pnpm type-check             # TypeScript type checking
```

## 最佳实践

### 运行检查和构建

如果任务涉及 TypeScript / JavaScript，你应当在每个任务完成后都**在项目根目录**运行一次 `pnpm type-check` 与 `pnpm lint`，检查是否引入了新的错误。

如果任务涉及原生代码，你应当在每个任务完成后**只对那个包**运行一次 `gradlew build`，并检查是否有构建错误。

### 搜索文件和 symbol

我们推荐使用 `codedb` mcp 搜索，而非使用 grep 手动搜索

### 提交信息

提交信息格式为 `scope: description`，scope 用受影响的模块或目录（如 `mobile`、`backend`、`root`），不要加 `feat` / `fix` / `chore` / `docs` 之类的 action 前缀。

## 仓库结构

### /apps

- mobile - React Native 移动应用（技术栈：Expo + Drizzle ORM + Material Design 3 + Zustand + TanStack Query）
- backend - 后端服务，主要提供歌单共享与软件更新查询（技术栈：Hono + ArkType + Drizzle ORM + CloudFlare Worker）
- docs - VuePress 文档网站
- update-publisher - 用于发布 App 版本更新信息的 TUI 工具
- update-server - 自托管的 Expo Updates（热更新）服务（技术栈：Go + PostgreSQL + Cloudflare R2）
- hot-update-cli - 发布与管理热更新的命令行工具

### /packages

- eslint-plugin — 项目自定义 lint 规则（经 oxlint jsPlugins 运行）
- expo-wavy-slider — Android 原生波形滑动条（Jetpack Compose）的 Expo 模块封装
- heatmap — 基于 SVG 的日期热力图组件
- image-theme-colors — 从图片中提取主题色的 Expo 原生模块
- logs — React Native 日志库
- native — BBPlayer 原生能力集成模块
- orpheus — BBPlayer 核心音频播放引擎
- splash — 歌词转换与解析库

## 导航与平板适配

- 底部标签栏使用 `expo-router/native-tabs`。它在 Android 上只有底部导航栏，没有 Navigation Rail，所以平板宽度（≥600dp）下隐藏原生标签栏，改用手写的 `apps/mobile/src/components/navigation/NavigationRail.tsx` 覆盖在根布局左侧
- 断点与布局尺寸统一定义在 `apps/mobile/src/hooks/ui/useResponsiveLayout.ts`（`BREAKPOINTS`、`MAX_WIDTH`），页面里不要自己比较宽高：
  - `useResponsiveLayout()` 返回 `isCompact`（宽 <360 或可用高度 <600）、`isTablet`（宽 ≥600）、`isExpanded`（宽 ≥840）、`isTwoPane`（宽 ≥840 且高 ≥600）
  - 页面内拿到的是 `ResponsiveContent` 测量的内容区尺寸，已扣除左右安全区和侧边导航栏；组件需要按自身尺寸判断时用 `isCompactSize()`
