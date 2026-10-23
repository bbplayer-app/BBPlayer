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


## macOS fork workflow

- The canonical local checkout is `/Users/lvjunhao/Documents/GitHub/BBPlayer-macOS`; develop the native app under `apps/macos`. The old sibling `BBPlayer` checkout was retired to the macOS Trash after verified migration; do not recreate or use it for ongoing work.
- This is Gino's personal macOS development project. The only permitted Git remote is `origin`, owned by `ginolyu3360-code`: `https://github.com/ginolyu3360-code/BBPlayer-macOS.git`. All existing branches must track this repository only. The user authorized commits and pushes here; use `codex/` feature branches.
- Do not fetch from, push to, open/reopen pull requests against, merge into, comment on, request reviews from, or otherwise contact `bbplayer-app/BBPlayer` (`https://github.com/bbplayer-app/BBPlayer`). Do not add an `upstream` remote. GitHub's fork provenance marker and source/license history may remain; they do not authorize any operational relationship.
- Always name repositories by owner and repository name, adding the full URL when useful. Do not use ambiguous labels such as "the original repository" or "原仓库" to identify a target.
- Pull requests, merges, publication, deployment and additional external review require their own explicit authorization. Any separately authorized PR must explicitly name `ginolyu3360-code/BBPlayer-macOS` as the base repository. Never infer authorization to contact `bbplayer-app/BBPlayer` from a request to push personal work.
- GitHub Actions in `ginolyu3360-code/BBPlayer-macOS` are disabled for personal local development. Do not enable inherited mobile publishing, wiki, scheduled update checks or deployment automation without an explicit request.
- For native macOS-only work, run `swift test --package-path apps/macos` and the relevant app build. The Android Gradle and mobile JavaScript checks apply only when those packages change.
- Read `apps/macos/IMPLEMENTATION.md` and `apps/macos/VALIDATION.md` for scope and evidence. Danmaku, full floating lyrics and larger sidebar navigation are implemented in the follow-up iteration; consult the validation record for what was actually tested. Instrumental recognition remains deferred.
- Local interview recovery is in `.grilling/` and is intentionally not committed. Continue the existing checkpoint without resetting its counters.
