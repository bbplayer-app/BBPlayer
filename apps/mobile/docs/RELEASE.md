# 发版流程 (Release Process)

本文档描述了 BBPlayer 的版本发布流程。

## 1. 准备版本

- **更新 `package.json`**：同步修改 `version` 字段与 `android.versionCode`。
- **编写变更说明**：整理本次发布的要点，更新 `apps/mobile/CHANGELOG.md` 文件。

## 2. 发起更新

- 提交一个 Pull Request (PR)，将 `dev` 分支的更改合并到 `master` 分支。
- PR 合并后，GitHub Actions 会自动触发。
- 在审批 (Approve) 通过后，CI 将开始运行构建流程并生成 Draft Release。
- 在 Draft Release 中填写详细的发布说明 (Release Notes)，确认无误后点击 Publish。

## 3. 更新 update.json

用于应用内检查更新。

- **推荐方式**：运行 `pnpm publish:update`，在 TUI 中选择 GitHub Release，确认生成的 update metadata，并发布到 Cloudflare Workers KV。
- **存储位置**：Cloudflare Workers KV 的 `update_json` key，由 backend 的 `/update.json` 路由读取。
- **字段说明**：
  - `version`：语义化版本号（如 `1.2.3`）。
  - `url`：GitHub Release 页面，作为回退链接。
  - `downloads.android`：按 ABI 保存的 APK 直链，例如 `arm64-v8a`。
  - `notes`：更新说明（支持多行文本）。
  - `listed_notes`：更新说明列表（推荐）。当存在此字段时，`notes` 会被忽略。
  - `forced`：布尔值，是否强制用户更新。
