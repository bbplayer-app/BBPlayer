# BBPlayer Update Server

自托管的 Expo Updates v1 服务。PostgreSQL 只保存分发状态、溯源信息与遥测数据；R2 保存所有不可变的 bundle、资源与 bsdiff 补丁。把 `.env.example` 复制到部署机的密钥存储处，并填好所有必填项。`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` 是 **R2 S3 API 凭据**，不是 Cloudflare API Token。`R2_PUBLIC_BASE_URL` 必须是 R2 存储桶上用于提供不可变对象的自定义域名。

`R2_PUBLIC_BASE_URL` 用于所有普通资源。启动用的 Hermes bundle 特意使用 API 的 URL：Expo 只有在抓取该资源时才会发送 `A-IM: bsdiff`，因此 API 必须在不可变的完整对象与不可变的补丁对象之间做选择。这是标准的 HTTP 内容协商，不依赖 Cloudflare Worker。

## 部署

运行时不会构建或编译任何东西：两个镜像都在构建机（或 CI）上提前产出，推送到镜像仓库，服务器通过 `docker compose pull` 拉取。compose 栈只运行预先构建好的镜像 tag：

```sh
# 构建 Go 镜像（api / migrate / worker 共用）。
docker build -t bbplayer-updates:VERSION apps/update-server

# 构建 WebUI nginx 镜像。构建上下文是 monorepo 根目录：
# 在 Dockerfile 内用 pnpm 构建 web 包。
docker build -t bbplayer-updates-web:VERSION -f apps/update-server/web/Dockerfile .
```

在服务器上把两个 tag 配为 `UPDATE_SERVER_IMAGE` / `UPDATE_SERVER_WEB_IMAGE`（见 [`.env.example`](.env.example)）；`dev` tag 对应本地直接 `docker build`、不经镜像仓库的开发流程。然后在一个 HTTPS 反向代理后面运行 `docker compose up -d`。PostgreSQL 与 nginx/API 通信位于 `internal` docker 网络；`api` 和 `worker` 还加入一个不发布端口的 `egress` 网络，以访问 Cloudflare R2 的公共 S3 endpoint。只有 `update-server-web` 发布一个宿主机端口——普通 compose 栈中是 `127.0.0.1:8080`——并且它是唯一入口：这个 nginx 服务对外提供管理后台，并把 `/admin/*`、`/api/*`、`/health` 经 internal 网络代理到 `api` 容器——UI 与 API 因此共享同一源（`PUBLIC_BASE_URL`，如 `https://updates.bbplayer.roitium.com`）。不可变的静态资源由 R2 自定义域名提供（`R2_PUBLIC_BASE_URL`，如 `https://assets-updates.bbplayer.roitium.com`）。一次性 `migrate` 服务使用内嵌的 Goose 迁移，用 PostgreSQL advisory lock 保护迁移过程，并且必须在 API 与补丁 worker 启动前完成。`worker` 刻意作为独立进程运行：bsdiff 的 CPU/内存开销很高，不能拖慢 manifest 响应。Docker 构建固定住 Expo 的 `bsdiff` 源码，若它无法产出其配套 `bspatch` 能逐字节还原的 `BSDIFF40` 补丁，构建就会失败。补丁认领（claim）有十分钟租约，因此被中断的 worker 不会让 channel 永久卡在 `processing`；在新的 worker 完成该任务之前，客户端会持续收到完整 bundle。

### 共享反向代理之后的生产部署

要在已有的、在宿主机上发布 HTTPS 的代理（如 Caddy）后面运行同一套栈，把 `update-server-web` 服务接入共享的 `proxy` docker 网络，并去掉它的宿主机端口：

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

该 overlay 会移除 `127.0.0.1:8080:80` 的绑定，并把 `update-server-web` 加入名为 `proxy` 的外部网络；没有其他服务加入该网络。把代理指向该服务名即可——Caddy 经共享网络解析 `update-server-web:80`，终止 TLS，而 `update-server-web` 内的 nginx 继续把 `/admin/*`、`/api/*`、`/health` 经 internal 网络代理到 `api:8080`：

```caddyfile
updates.bbplayer.roitium.com {
	reverse_proxy update-server-web:80
}
```

若外层 HTTPS 代理也是 nginx，必须同时允许发布归档通过；否则请求会在到达
`update-server-web` 前返回 `413 Request Entity Too Large`：

```nginx
location = /admin/publish {
	client_max_body_size 256m;
	proxy_pass http://update-server-web:80;
}
```

内置的 `update-server-web` nginx 已对同一路径设置 256 MiB 限制；变更后需重建并
部署该 Web 镜像。外层 nginx 的限制不会自动继承这一设置。

所有必填的部署配置都列在 [`.env.example`](.env.example)：

- `POSTGRES_PASSWORD`、`DATABASE_URL` 与 `POSTGRES_DATA_PATH`（PostgreSQL 数据的宿主机目录）
- `R2_BUCKET`、`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BASE_URL`、`PUBLIC_BASE_URL`
- 相互独立的 `ADMIN_TOKEN` 与 `INSTALLATION_HMAC_KEY`

`R2_ENDPOINT` 仅用于 MinIO/S3 兼容的本地测试。`CODE_SIGNING_*` 只有在本机应用配置为启用 Expo code signing 之后才需要。

## 发布与运维

面向开发者的热更新 CLI 用 TypeScript 编写，因此它能调用 Expo 自己的 `@expo/fingerprint` 库并保留完整的源码报告。在 `apps/mobile` 下运行：

```sh
pnpm hot-update
```

它会交互式询问 channel、发布说明和缺失的服务器凭据，在发布前警告脏工作区，运行 `expo export`，导出公开的 Expo 配置，生成 Android fingerprint，并上传归档。它的 Git 溯源信息只有 `commit_sha` 与 `working_tree_clean`。上传 fingerprint 时，完整的 `{ hash, sources }` 会与更新组一同保存，且其 hash 必须等于提供的 `runtimeVersion`。`--no-fingerprint` 则要求显式给出 `--runtime-version`，并且不保存 fingerprint 记录。

若 `dist` 已由同一项目的 Expo export 生成，可使用 `--skip-export` 跳过 bundler：CLI 会
校验其中的 `metadata.json`、写入当前公开 Expo 配置，然后直接归档上传。

首次成功提供 URL 与 token 后，CLI 会把它们保存到项目的
`.bbplayer-updates/credentials.json`（Git 已忽略，目录权限为仅当前用户）。后续会优先
使用命令行参数，其次是 `BBPLAYER_UPDATE_SERVER_URL` /
`BBPLAYER_UPDATE_SERVER_TOKEN`，最后才是该本地凭据文件。

CI 以非交互方式使用完全相同的命令：

```sh
pnpm hot-update -- publish --non-interactive --channel production --message "..."
```

非交互发布会拒绝脏 checkout，除非显式指定 `--allow-dirty`。每次新发布都会为每个兼容平台从上一个可见的 channel head 到新 head 创建一个异步 bsdiff 任务。在任务变为 `ready` 之前，客户端收到的是完整的不可变 bundle。

热更新 CLI 调用 `createFingerprintAsync(projectDir, { platforms: ['android'] })`，而不是调用 EAS CLI。这让生成的运行时 hash 与人类可调试的源码列表来自同一次库调用。

独立的 `apps/update-client` CLI 发起 Expo 风格的 manifest 请求，下载并校验返回的资源，并上报带版本号的测试事件信封。给 `check` 传 `--current-update-id <uuid>` 可演练一次 ready 状态的 bsdiff 响应；该 CLI 会检查 `226`、`IM: bsdiff` 与 `BSDIFF40` 不变量。

所有管理操作都由交互式 TypeScript CLI 提供（并支持脚本化用的 `--json`）：

```sh
pnpm --dir apps/hot-update-cli start -- list --server https://updates.example --token ...
pnpm --dir apps/hot-update-cli start -- channel --action history --channel production --server https://updates.example --token ... --json
pnpm --dir apps/hot-update-cli start -- insights --server https://updates.example --token ... --json
pnpm --dir apps/hot-update-cli start -- source --action compare --from <from-group> --to <to-group> --server https://updates.example --token ...
```

`source compare` 保持与早期更详细的溯源信息兼容，而新发布刻意只记录单个 commit。`insights` 命令暴露客户端结果，以及完整与 bsdiff 请求的数量、字节数、节省字节数、命中率与回退情况。

完整的管理面也已从现有 Chi 路由生成 OpenAPI 3.1 文档。它与所有其他 `/admin` 路由一样使用 `Authorization: Bearer <ADMIN_TOKEN>` 认证：

```text
GET /admin/openapi.json
GET /admin/openapi.yaml
GET /admin/docs
```

`/api` 下公开的 Expo 协议路由刻意不收录进这份文档；它们的 multipart 与内容协商契约保持不变。

## 可观测性

PostgreSQL 就是指标后端；本服务刻意不暴露 Prometheus 端点，也不要求 OTel collector。请求数、5xx 错误数与耗时按分钟聚合到 `service_metric_minutes` 桶里。启动 bundle 与 bsdiff 分发在 `delivery_metric_minutes` 中按同样的方式聚合；普通更新资源刻意留在 R2 自定义域名上，不计入 API 指标。

通过认证的 WebUI 用户可以查询：

```text
GET /admin/metrics/service?start=<RFC3339>&end=<RFC3339>&route=<optional>
GET /admin/metrics/delivery?start=<RFC3339>&end=<RFC3339>&channel=<optional>&group_id=<optional>
GET /admin/insights/activity?start=<RFC3339>&end=<RFC3339>&channel=<optional>
GET /admin/insights/groups/<group-id>/lifecycle?start=<RFC3339>&end=<RFC3339>
```

### WebUI 登录

管理后台从不内嵌 token。访问同源下的任何页面都会显示登录页；运维人员输入的 token 会先经 `GET /admin/session` 校验（与所有 `/admin` 路由一样位于同一 bearer 中间件之后），随后存入 `localStorage`，并在每次请求中以 `Authorization: Bearer <ADMIN_TOKEN>` 发送。任何 `401` 都会清掉它并回到登录页，因此轮换 `ADMIN_TOKEN` 会把活跃的浏览器登出。

两个端点默认最近七天，最多接受 90 天。原始客户端生命周期事件保留 35 天；分钟级指标保留 90 天。worker 每天做保留期清理。`activity` 按安装 HMAC、运行中的更新、应用版本与日期去重。`launch_succeeded` 或 `launch_healthy` 会为每次安装/更新创建一条 known launch 记录；`launch_failed` 或 `launch_crashed` 创建一条 known crash。客户端的 activity/version 图表与这些保守的生命周期计数由移动端 OTA 集成上报。生产构建从 `https://updates.bbplayer.roitium.com/api/manifest` 请求 manifest，并把遥测上报到同一源的 `/api/events`；在发布这种构建之前，先把 API 部署到该源上。

## 集成验证

`docker compose -f docker-compose.e2e.yml up -d` 会启动 PostgreSQL 17 与 MinIO。然后运行：

```sh
E2E_DATABASE_URL='postgres://updates:updates-test@127.0.0.1:55432/updates?sslmode=disable' \
  go test ./internal/server -run TestE2EExpoProtocol -count=1 -v
```

该套件模拟 Expo 的 manifest 与资源请求，校验不可变资源的 hash，校验带版本号的事件信封，并证明事件幂等性。
