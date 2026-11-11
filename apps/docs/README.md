# @bbplayer/docs

BBPlayer 官方网站，使用 Astro + Starlight 静态构建，不依赖 Vue 或 React。

- `src/content/docs/`：Markdown/MDX 指南与首页。
- `src/pages/`：曲目分享、歌单预览和 App 跳转失败页面，使用原生 Astro。
- `src/scripts/`：读取分享参数、请求歌单预览和生成 App 链接的浏览器脚本。
- `public/`：静态资源，包括 Android App Links 的 `.well-known/assetlinks.json`。

所有命令从仓库根目录运行：

```bash
pnpm install
pnpm --filter @bbplayer/docs docs:dev
pnpm --filter @bbplayer/docs docs:build
pnpm --filter @bbplayer/docs docs:preview
pnpm --filter @bbplayer/docs type-check
pnpm --filter @bbplayer/docs docs:worker
pnpm --filter @bbplayer/docs docs:deploy
```

`docs:build` 先运行 `astro check`，再输出静态站点到 `apps/docs/dist/`。部署平台应使用此输出目录；无需服务端适配器。Node.js 版本需满足 Astro 的要求（当前为 `>=22.23.4`）。

指南通过 Starlight 管理侧栏、分页、中文界面和本地全文搜索。分享页继续保留 `/share/track`、`/share/playlist` 和 `/app-not-exist` 路径，在浏览器中读取查询参数与加载预览，构建时不请求分享后端。

## Cloudflare Workers

`wrangler.jsonc` 将 `dist/` 作为 Worker 静态资源发布，无需 Astro 服务端适配器或 Worker 入口代码。Wrangler 会先执行文档构建；`docs:worker` 可在本地验证与生产相同的资源路由，`docs:deploy` 将站点部署到 `bbplayer-docs`。

官网域名为 `bbplayer.roitium.com`，由 Workers Custom Domain 管理 DNS 与 HTTPS。配置保留 `workers.dev` 地址，方便排查部署。不存在的路径返回自定义 404 页面，旧的无尾斜杠链接及查询参数由静态资源路由处理。

部署前需完成 `wrangler login`。维护 DNS 使用 mise 安装的 `cf` CLI；如果找不到命令，运行 `mise reshim`。自定义域名首次接管时需移除同名的旧 CNAME，后续部署无需手动修改 DNS。

### GitHub 自动部署

Cloudflare Workers Builds 已连接 `bbplayer-app/BBPlayer`，生产分支为 `dev`，关闭其他分支的预览构建。构建从仓库根目录运行 `pnpm --filter @bbplayer/docs docs:deploy`；Wrangler 配置会先构建文档，因此 Builds 的独立构建命令留空，避免重复构建。

构建环境使用 `NODE_VERSION=26.13.0`、`PNPM_VERSION=11.25.0`，启用构建缓存。Watch paths 仅包含：

```text
apps/docs/**
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
patches/**
lefthook.yml
mise.toml
.npmrc
.node-version
.nvmrc
```

修改其他应用源码不会触发官网构建；根锁文件或安装配置变化仍会触发，以确保依赖更新能部署。首次自动部署需要先将文档迁移与 Wrangler 配置推送到 `dev`。
