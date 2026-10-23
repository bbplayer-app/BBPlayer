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

- Use this repository checkout and develop the native app under `apps/macos`. The retired sibling checkout must not be recreated or used for ongoing work.
- The only permitted Git remote is the already configured `origin`. Verify its owner and repository locally before any authorized Git operation; do not change its URL or add remotes. All existing branches must track this repository only. Existing user authorization for commits and pushes applies only here; use descriptive feature branch names without AI or tool branding.
- Keep `main` as the default branch and the verified development baseline. Small, low-risk fixes may go directly to `main` after relevant checks. Develop larger or riskier changes on temporary feature branches, validate them, then merge locally into `main` and remove the merged branches after authorization. A permanent `dev` branch and pull requests are not required for this workflow.
- Do not fetch from, push to, open/reopen pull requests against, merge into, comment on, request reviews from, or otherwise contact `bbplayer-app/BBPlayer` (`https://github.com/bbplayer-app/BBPlayer`). Do not add an `upstream` remote. GitHub's fork provenance marker and source/license history may remain; they do not authorize any operational relationship.
- Always name repositories by owner and repository name, adding the full URL when useful. Do not use ambiguous labels such as "the original repository" or "原仓库" to identify a target.
- Pull requests, merges, publication, deployment and additional external review require their own explicit authorization. Any separately authorized PR must target the repository verified from the configured `origin`. Never infer authorization to contact `bbplayer-app/BBPlayer` from a request to push personal work.
- GitHub Actions in this repository are disabled for local development. Do not enable inherited mobile publishing, wiki, scheduled update checks or deployment automation without an explicit request.
- After every successful authorized push, rebuild the native macOS Release app from the pushed revision using the configured persistent signing identity, verify its signature, and replace the canonical installed app. Only after installed/build contents match, remove managed obsolete app backups, old packaged archives and recognized temporary diagnostic apps so managed runnable copies contain only the latest version. Keep rollback material until verification succeeds; preserve music, downloads, credentials, signing keys and source history. A pre-push build does not satisfy this rule. Report failures accurately and never install a stale or ad-hoc artifact. This authorizes local replacement/managed-package cleanup after an authorized push, but does not grant standing authorization for new pushes, merges or publication.
- For native macOS-only work, run `swift test --package-path apps/macos` and the relevant app build. The Android Gradle and mobile JavaScript checks apply only when those packages change.
- After substantial macOS changes, check whether the installed app needs updating and explicitly offer or remind the user to run `apps/macos/scripts/update-local.sh`. The command requires committed changes and a stopped app, and runs tests, builds, pushes `main` to the verified personal origin, rebuilds after the push, and installs with temporary rollback protection followed by verified obsolete-package cleanup. For an authorized feature-branch push, push that branch explicitly, then use `--install-only` to test, rebuild and install it without merging or pushing `main`. Do not silently interrupt unrelated playback; pushing still needs its own authorization.
- Read `apps/macos/IMPLEMENTATION.md` and `apps/macos/VALIDATION.md` for scope and evidence. Danmaku, full floating lyrics and larger sidebar navigation are implemented in the follow-up iteration; consult the validation record for what was actually tested. Instrumental recognition remains deferred.
- Local interview recovery is in `.grilling/` and is intentionally not committed. Continue the existing checkpoint without resetting its counters.

## Privacy in repository files

- Do not include the user's name, nickname, account handles, contact details, personal background or machine-specific absolute paths in tracked files, README files, comments, examples or validation records. Use repository-relative paths and neutral project descriptions.
- Do not copy personal profile or conversation details into the repository. Verify repository ownership from local Git configuration when necessary without embedding the user's account in documentation.
- Before delivery, inspect the full diff and search tracked files for personal identifiers and home-directory paths. Preserve required third-party attribution and licenses.
