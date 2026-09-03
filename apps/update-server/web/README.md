# Update Server Web UI

The admin UI is a Vite multi-page application that proxies `/admin/*` requests
to the local update server at `http://127.0.0.1:8080`. Overview, Channels,
Update groups, Runtimes, and their detail views are separate HTML entries;
navigation does not depend on a client-side router.

```sh
cp .env.example .env.local
# Set VITE_ADMIN_TOKEN to the same value used by the server.
pnpm --filter @bbplayer/update-server-web dev
```

Open <http://localhost:4173>. For a separately hosted API, set
`VITE_API_BASE_URL` to that API origin too.
