# 贡献指南 (Contributing Guide)

欢迎来到 BBPlayer 项目！我们非常感谢你对开源社区的贡献。在开始之前，请花一点时间阅读以下指南，这将帮助你更高效地参与开发。

## 🚀 快速开始 (Getting Started)

## 🚀 快速开始 (Getting Started)

### 1. 环境准备

- **包管理器**: 必须使用 **pnpm**。
- **Android 环境**: 配置好 Android Studio 和 SDK。
- **mise (可选)**: 我们推荐使用 [mise](https://mise.jdx.dev/) 来管理环境变量和任务脚本。

### 2. 安装依赖

在项目根目录下运行：

```bash
pnpm install
```

### 3. 配置环境变量

你可以通过 `.env.local` 文件或 export 命令配置以下环境变量：

- **VERSION_CODE**: (必须) 用于标记构建版本。
  - 推荐命令: `git rev-list --count HEAD`
- **SENTRY_AUTH_TOKEN**: (可选) Sentry 错误追踪。
  - **dev 构建**: 不需要此 Token
  - **production / preview 构建**: 需要真实 Token 以上传符号表。

### 4. 构建基座 (Development Build)

本项目包含原生代码，**不能**直接使用 Expo Go 运行。你需要先构建自定义基座。

**方式 A: 使用 EAS (推荐)**

参考 `apps/mobile/mise.toml`，运行构建命令：

```bash
# 如果安装了 mise (需要传入 version 参数)
mise run builddev --version 1.0.0

# 或者直接运行 eas 命令
cd apps/mobile
VERSION_CODE=$(git rev-list --count HEAD) eas build --profile dev --platform android --local --output=./temp-builds/bbplayer-1.0.0-dev.apk
```

**方式 B: 传统 Prebuild**

如果你更习惯使用原生工具链：

```bash
cd apps/mobile
# 生成原生目录 (android/ios). 推荐加上 --clean 以确保配置生效
npx expo prebuild --clean

# 编译并安装到设备
npx expo run:android
```

### 5. 启动开发

构建并安装应用后，启动 Metro 服务器进行开发：

```bash
cd apps/mobile
pnpm expo start
```

> [!IMPORTANT]
> **Firebase 配置 (Firebase Configuration)**
>
> 项目包含模拟的 Firebase 配置文件 (`google-services.json` 和 `GoogleService-Info.plist`)，你可以直接运行项目。
>
> 如果你需要使用真实的 Firebase 功能（如 Analytics），请将你的真实配置文件重命名为：
>
> - `google-services.real.json`
> - `GoogleService-Info.real.plist`
>
> 并放在 `apps/mobile/assets/config/google-services/` 目录下。使用 eas 构建时会自动优先使用真实文件。（如果不使用 eas 构建，则需要在放置真实文件后，运行 `npx expo prebuild --clean`）

## 📂 文档导航

为了更好地理解项目，建议按以下顺序阅读文档：

1.  **[架构指南 (ARCHITECTURE.md)](./ARCHITECTURE.md)**: 必读。了解项目的核心架构、分层模式（Facade/Service）以及目录结构。
2.  **[开发规范 (BEST_PRACTICES.md)](./BEST_PRACTICES.md)**: 了解 UI 开发优化（FlashList）、代码风格等最佳实践。
3.  **[发版流程 (RELEASE.md)](./RELEASE.md)**: 版本发布的操作指南。
4.  **[技术债与路线图 (TECHNICAL_DEBT.md)](./TECHNICAL_DEBT.md)**: 了解当前已知问题和待改进项。

## 💻 开发工作流

### 分支管理

- **master**: 主分支，对应最新版本的代码。
- **dev**: 开发分支，所有的 PR 请提交到此分支。
- **feat/xyz**: 新功能分支。
- **fix/xyz**: 问题修复分支。

### 提交规范

我们推荐使用语义化提交信息 (Conventional Commits)：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `style`: 代码格式修改 (不影响逻辑)
- `refactor`: 代码重构
- `chore`: 构建过程或辅助工具的变动

### 代码质量

我们使用 lefthook 来自动执行代码检查和格式化，请确保你配置好了 lefthook。

## 🤝 贡献代码

1. Fork 本仓库。
2. 基于 `dev` 分支创建你的功能分支 (`git checkout -b feat/amazing-feature`)。
3. 提交你的修改。
4. 推送到你的 Fork 仓库。
5. 提交 Pull Request 到本仓库的 `dev` 分支。

感谢你的参与！
