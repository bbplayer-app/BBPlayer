# 发版流程

其实并没有多少要做的。

## 1. 准备版本

- 更新 `package.json`：同步修改 `version` 与 `versionCode`。
- 完成变更说明：整理本次发布的要点，在 v1.3.2 之后统一采用 `CHANGELOG.md` 管理更新日志。

## 2. 发起更新

- 提一个 PR，从 `dev` 分支合并到 `master` 分支。
- PR 合并后，Action 会自动触发。在 Approve 后，CI 会开始运行构建及 Draft Release 流程。
- 在 Draft Release 中添加发布说明，发布即可。

## 3. 更新 update.json

- 文件位置：仓库根目录 `./update.json`。
- 字段约定：
  - `version`：语义化版本号（如 `1.2.3`）。
  - `url`：下载链接（APK 或 Release 页面）。
  - `notes`：更新说明（支持多行）。
  - `listed_notes`：采用列表格式更清晰地列出更新说明。（当和 `notes` 同时存在时，`notes` 会被忽略）
  - `forced`：是否为强制更新

## 4. 在 JSDelivr 上刷新 update.json 缓存
