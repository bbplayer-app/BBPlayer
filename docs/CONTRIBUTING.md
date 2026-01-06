# 贡献指南 (Contributing Guide)

欢迎来到 BBPlayer 项目！我们非常感谢你对开源社区的贡献。在开始之前，请花一点时间阅读以下指南，这将帮助你更高效地参与开发。

## 🚀 快速开始 (Getting Started)

### 环境准备

本项目的开发环境基于 Node.js 和 React Native (Expo)。

1.  **Node.js**: 推荐使用 LTS 版本 (v18+)。
2.  **包管理器**: 必须使用 **pnpm**。
    ```bash
    npm install -g pnpm
    ```
3.  **移动开发环境**:
    - **Android**: 安装 Android Studio 并配置 Android SDK。
    - **iOS** (仅 macOS): 安装 Xcode 和 CocoaPods。

### 安装依赖

在项目根目录下运行：

```bash
pnpm install
```

### 启动项目

```bash
# 启动开发服务器
pnpm start

# 运行 Android 模拟器
pnpm android

# 运行 iOS 模拟器 (仅 macOS)
pnpm ios
```

## 📂 文档导航

为了更好地理解项目，建议按以下顺序阅读文档：

1.  **[架构指南 (ARCHITECTURE.md)](./ARCHITECTURE.md)**: 必读。了解项目的核心架构、分层模式（Facade/Service）以及目录结构。
2.  **[开发规范 (BEST_PRACTICES.md)](./BEST_PRACTICES.md)**: 了解 UI 开发优化（FlashList）、代码风格等最佳实践。
3.  **[发版流程 (RELEASE.md)](./RELEASE.md)**: 版本发布的操作指南。
4.  **[技术债与路线图 (TECHNICAL_DEBT.md)](./TECHNICAL_DEBT.md)**: 了解当前已知问题和待改进项。

## 💻 开发工作流

### 分支管理

- **master**: 主分支，对应稳定版本。
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

在提交代码前，请确保通过了 lint 检查和类型检查：

```bash
# 类型检查
pnpm type-check

# Lint 检查
pnpm lint
```

## 🤝 贡献代码

1. Fork 本仓库。
2. 基于 `dev` 分支创建你的功能分支 (`git checkout -b feat/amazing-feature`)。
3. 提交你的修改。
4. 推送到你的 Fork 仓库。
5. 提交 Pull Request 到本仓库的 `dev` 分支。

感谢你的参与！
