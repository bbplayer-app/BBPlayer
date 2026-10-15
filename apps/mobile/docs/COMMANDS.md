# 项目命令

所有日常命令都从仓库根目录执行，统一使用 mise。依赖安装仍由 pnpm 完成；packages 的命令保持原样。

```bash
mise install
mise run install
mise tasks ls --all
```

要求 mise 2026.9.15 或以上。根 `mise.toml` 启用原生 monorepo 模式，通过 `monorepo.config_roots` 列出 apps。根任务直接定义在根配置中，各 app 的任务定义在自己的 `mise.toml`；不再使用集中任务目录。

`config_root` 是 mise 内置的模板变量，无需手动定义。它指向任务所属项目的配置根目录：mobile 任务中是 `apps/mobile`，backend 任务中是 `apps/backend`。任务默认在自己的项目目录运行，继承根工具版本，并加载项目自己的环境配置。

支持两种根目录调用方式，短名通过任务自身的 alias 提供，没有额外转发层：

```bash
mise run mobile:start --clear
mise run //apps/mobile:start --clear
```

在 app 目录内可使用 `mise run :start`（例如 mobile），但日常操作与 CI 统一从根调用。当前版本的 `tasks info` 需要使用列表显示的完整路径，例如 `mise tasks info //apps/mobile:start` 或 `mise tasks info //:lint`；执行任务仍可以使用短别名。

| 任务所属目录           | 配置与职责                                  |
| ---------------------- | ------------------------------------------- |
| 仓库根目录             | mise.toml：共享工具、检查、格式化与依赖安装 |
| apps/mobile            | mise.toml：Metro、Android、EAS 与冷启动测量 |
| apps/backend           | mise.toml：Wrangler 与 Drizzle              |
| apps/docs              | mise.toml：VitePress                        |
| apps/hot-update-cli    | mise.toml：OTA 菜单、发布与管理操作         |
| apps/update-publisher  | mise.toml：安装包更新元数据发布             |
| apps/update-server     | mise.toml：Go API、worker、迁移、测试与镜像 |
| apps/update-server/web | mise.toml：管理后台开发、构建与检查         |

## 根项目检查

| 命令                         | 用途                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `mise run check`             | 顺序执行依赖版本、TypeScript、lint 检查；任一步失败即停止 |
| `mise run check:deps`        | 检查依赖版本一致性                                        |
| `mise run fix:deps`          | 修正依赖版本                                              |
| `mise run type-check`        | 检查根 tsconfig 引用的项目                                |
| `mise run lint` / `lint:fix` | lint 检查 / 自动修复                                      |
| `mise run format`            | 格式化工作区                                              |

`check` 不包含 packages 中的全部独立测试或原生构建。

## 移动端

| 命令                                               | 用途                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| `mise run mobile:start`                            | 启动开发版 Metro，支持 `--clear` 等 Expo 参数          |
| `mise run mobile:android`                          | clean prebuild 后构建并安装开发版 Android              |
| `mise run mobile:start:production-debug`           | 启动生产包调试使用的 Metro                             |
| `mise run mobile:android:production-debug`         | 使用本地生产签名构建生产包 debug 应用                  |
| `mise run mobile:build:prod <prefix>`              | arm64-v8a 生产 APK                                     |
| `mise run mobile:build:dev <prefix>`               | arm64-v8a development client APK                       |
| `mise run mobile:build:preview <prefix>`           | arm64-v8a preview APK                                  |
| `mise run mobile:emulator`                         | 启动 Medium_Phone_API_36.1 AVD                         |
| `mise run mobile:measure-cold-start [N] [PACKAGE]` | 通过 ADB 测量冷启动，结果写入 apps/mobile/metrics_runs |
| `mise run mobile:router-types`                     | 生成 CI 检查所需的 Expo Router 配置                    |
| `mise run mobile:sourcemaps`                       | 将已有 dist 的 source maps 上传至 Sentry               |

构建参数只是文件名前缀，不修改应用版本，输出位置为 `apps/mobile/temp-builds/<prefix>-<类型>.apk`。构建任务使用 EAS local build；生产包 debug 需要 apps/mobile/credentials.json 及对应 keystore。

`mobile:build:ci` 供 CI 调用：从环境读取 EAS_PROFILE、APK_TEMP_PATH、ABI_FILTERS 与 VERSION_CODE，复用 CI 原有的 EAS 安装和构建流程。

## 热更新与安装包更新

```bash
mise run ota                         # 交互菜单
mise run ota:fingerprint --json
mise run ota:list --json
mise run ota:show --group <group-id>
mise run ota:channel --action history --channel production
mise run ota:source --action compare --from <group-id> --to <group-id>
mise run ota:insights --channel production --json
mise run ota:publish --non-interactive --channel production --message "更新说明"
mise run release:metadata
```

- `ota` 可直接转发任意现有 CLI 操作，例如 `mise run ota source --action find --commit <sha>`。
- `ota:publish` 导出并发布热更新；`ota:republish` 将历史更新资源重新发布为新更新。
- `release:metadata` 选择已有 GitHub Release，使用 Zed 编辑安装包更新元数据，再确认写入远程 Cloudflare KV。
- `ota:check` 与 `release:metadata:check` 分别检查两个 CLI 的 TypeScript。

热更新凭据来自 CLI 参数、BBPLAYER_UPDATE_SERVER_URL/TOKEN 或本地 .bbplayer-updates 凭据文件。此次仅迁移现有命令；CHANGELOG 自动归档与 GitHub OTA Release 发布尚未实现。

## Backend、文档与更新服务

| 入口                                                           | 对应能力                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `backend:dev` / `backend:deploy`                               | Wrangler 开发 / 部署                                                              |
| `backend:cf-typegen`                                           | 生成 Cloudflare 类型                                                              |
| `backend:db:generate` / `db:migrate` / `db:push` / `db:studio` | 各任务须带完整 backend: 前缀，分别对应 Drizzle generate / migrate / push / studio |
| `docs:dev` / `docs:build` / `docs:preview`                     | VitePress                                                                         |
| `server:web:dev` / `server:web:build` / `server:web:preview`   | 更新管理后台                                                                      |
| `server:web:type-check`                                        | 管理后台 TypeScript 检查                                                          |
| `server:api` / `server:worker` / `server:migrate`              | Go API、补丁 worker、数据库迁移；部署环境变量由调用者提供                         |
| `server:test`                                                  | Go 测试；E2E 另需 PostgreSQL/MinIO 与 E2E_DATABASE_URL                            |
| `server:images:publish`                                        | 构建并推送 API/Web 镜像                                                           |

上述入口都通过 `mise run <任务名>` 执行。deploy、publish、migrate、db:push 等仍具有原有写入影响。

## 环境与终端输出

mobile 项目统一加载自己的 .env.local；OTA 任务显式加载相邻 mobile 项目的 .env.local；backend 项目统一加载自己的 .dev.vars。根检查、docs、publisher、Go 服务和 WebUI 任务不加载这些 app 的环境文件。

Metro、EAS、开发服务器及发布菜单使用 `raw = true`：直接继承终端输入和输出，保留颜色、spinner 和同一行进度刷新。本地任务和 apps 环境文件默认不标记脱敏。只有 CI 使用的 `mobile:build:ci`、`ota:publish`、`ota:fingerprint`、`mobile:sourcemaps` 保留环境文件的 `redact = true` 标记。raw 输出仍会绕过 mise 脱敏，CI 中通过 GitHub Actions secrets 注入的密钥由 GitHub 自身掩码保护。普通检查任务保留正常输出处理。

CI 安装固定版本的 mise 作为任务运行器，保留现有 Node/pnpm/EAS 安装方式，使用 `--skip-tools` 避免额外安装 Go、Java 或其他无关工具。

## 兼容入口

根项目及 mobile/backend/docs 中转发到 mise 的 package scripts 已删除；日常命令直接使用 `mise run <任务>`。根 `postinstall` 继续直接安装 Lefthook。使用 `mise tasks ls --all` 发现任务，`mise tasks info <完整任务路径>` 查看定义；设置了 raw_args 的任务会将 `--help` 转发给底层工具。

旧 mobile mise 名称 android、start、buildprod、builddev、buildpreview、emulator 及生产包调试名称保留为别名；新文档统一使用带 mobile: 前缀的入口。

hot-update-cli、update-publisher 和 update-server/web 的包内标准 scripts 保留，供 mise 和 Docker 作为底层执行入口使用，不反向调用 mise。packages 本次没有迁移。
