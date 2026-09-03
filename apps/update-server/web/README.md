# Update Server Web UI

管理后台是一个 Vite 多页应用。Overview、Channels、Update groups、Runtimes 及其详情视图都是独立的 HTML 入口；导航不依赖客户端路由。

生产环境中，构建产物由 `apps/update-server/docker-compose.yml` 里的 `update-server-web` 服务提供：它是一个 nginx 容器，负责提供静态文件并把 `/admin/*`、`/api/*`、`/health` 代理到 `api` 容器。因此 UI 与 API 共享同一源（`https://updates.bbplayer.roitium.com`），而更新服务器继续从 `https://assets-updates.bbplayer.roitium.com` 提供绑定到 R2 的资源。

## 鉴权

UI 不内嵌任何 token。每个页面都由登录页把关，要求输入与服务器从环境变量读取的同一个 `ADMIN_TOKEN`；token 会先经 `GET /admin/session` 校验，然后以 `bbplayer.admin.token` 为键存入 `localStorage`。所有请求都会带上 `Authorization: Bearer <token>`。任何请求返回 `401` 都会清除已存 token 并把用户带回登录页。

## 本地开发

```sh
pnpm --filter @bbplayer/update-server-web dev
```

打开 <http://localhost:4173>。开发服务器把 `/admin/*` 代理到 `http://127.0.0.1:8080`——在本地 docker compose 栈中，该端口属于 `update-server-web` nginx 服务，它会经 internal docker 网络转发到 `api` 容器。用你 `.env` 里的 token 登录。若 API 单独部署，把 `VITE_API_BASE_URL` 设为那个 API 源。

## 生产镜像

`update-server-web` 服务由本目录的 `Dockerfile` 构建，构建上下文是 monorepo 根目录（多阶段构建需要工作区的 `package.json` / `pnpm-lock.yaml`）。在 monorepo 根目录运行：

```sh
docker build -t bbplayer-updates-web:dev -f apps/update-server/web/Dockerfile .
```
