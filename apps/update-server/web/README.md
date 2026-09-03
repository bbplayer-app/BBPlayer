# Update Server Web UI

The admin UI is a Vite multi-page application. Overview, Channels, Update
groups, Runtimes, and their detail views are separate HTML entries;
navigation does not depend on a client-side router.

In production the built site is served by the `web` service in
`apps/update-server/docker-compose.yml`: an nginx container that serves the
static files and proxies `/admin/*`, `/api/*` and `/health` to the `api`
container. The UI and the API therefore share one origin
(`https://updates.bbplayer.roitium.com`), and the update server keeps serving
R2-bound assets from `https://assets-updates.bbplayer.roitium.com`.

## Authentication

The UI does not embed any token. Every page is gated by a sign-in screen that
asks for the same `ADMIN_TOKEN` the server reads from its environment; the
token is validated against `GET /admin/session` and then kept in
`localStorage` under `bbplayer.admin.token`. All requests send it as
`Authorization: Bearer <token>`. A `401` from any request clears the stored
token and returns the user to the sign-in screen.

## Local development

```sh
pnpm --filter @bbplayer/update-server-web dev
```

Open <http://localhost:4173>. The dev server proxies `/admin/*` to
`http://127.0.0.1:8080` — in the local docker compose stack that port is the
`web` nginx service, which forwards to the `api` container. Sign in with the
token from your `.env`. For a separately hosted API, set `VITE_API_BASE_URL`
to that API origin.

## Production image

The `web` service is built from this folder's `Dockerfile` with the monorepo
root as build context (its multi-stage build needs the workspace
`package.json`/`pnpm-lock.yaml`). Run from the monorepo root:

```sh
docker build -t bbplayer-updates-web:dev -f apps/update-server/web/Dockerfile .
```
