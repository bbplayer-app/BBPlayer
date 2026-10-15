# BBPlayer

BBPlayer 是一个基于 React Native 开发的 BiliBili 流媒体音乐软件，整个仓库为 monorepo

## 命令

注意，所有命令都应当在项目根目录运行。根项目和 apps 的日常任务统一通过 `mise run <task>` 执行；先用 `mise tasks ls --all` 发现任务，用 `mise tasks info <完整任务路径>` 查看定义（例如 `//apps/mobile:start` 或 `//:lint`）。不要假设 package.json 存在对应 scripts。各 app 的任务定义在自己目录下的 mise.toml，支持短别名及 `//apps/<project>:<task>` 路径调用。packages 暂时保留原有入口。

```bash
mise run install               # 底层仅使用 pnpm 安装依赖
mise run check                 # 顺序执行依赖、类型与 lint 检查
mise run lint                  # oxlint
mise run lint:fix              # Auto-fix
mise run format                # oxfmt
mise run type-check            # TypeScript type checking
mise run mobile:start          # 启动开发版 Metro
mise tasks ls --all                  # 查看全部任务
```

## 最佳实践

### 运行检查和构建

如果任务涉及 TypeScript / JavaScript，你应当在每个任务完成后都**在项目根目录**运行一次 `mise run type-check` 与 `mise run lint`，检查是否引入了新的错误。

如果任务涉及原生代码，你应当在每个任务完成后**只对那个包**运行一次 `gradlew build`，并检查是否有构建错误。

### 搜索文件和 symbol

我们推荐使用 `codedb` mcp 搜索，而非使用 grep 手动搜索

## 仓库结构

### /apps

- mobile - React Native 移动应用（技术栈：Expo + Drizzle ORM + Material Design 3 + Zustand + TanStack Query）
- backend - 后端服务，主要提供歌单共享与软件更新查询（技术栈：Hono + ArkType + Drizzle ORM + CloudFlare Worker）
- docs - VuePress 文档网站
- update-publisher - 用于发布更新的工具

### /packages

- bottom-tabs-react-navigation — React Native 原生底部标签栏与 React Navigation 的桥接适配层
- eslint-plugin — 项目自定义 lint 规则（经 oxlint jsPlugins 运行）
- expo-wavy-slider — Android 原生波形滑动条（Jetpack Compose）的 Expo 模块封装
- heatmap — 基于 SVG 的日期热力图组件
- image-theme-colors — 从图片中提取主题色的 Expo 原生模块
- logs — React Native 日志库
- native — BBPlayer 原生能力集成模块
- orpheus — BBPlayer 核心音频播放引擎
- react-native-bottom-tabs — 跨平台原生底部标签栏组件
- splash — 歌词转换与解析库
