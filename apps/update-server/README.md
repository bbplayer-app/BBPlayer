# BBPlayer Update Server

Self-hosted Expo Updates v1 service. PostgreSQL holds only delivery state,
provenance and telemetry; R2 holds every immutable bundle, asset and bsdiff
patch. Copy `.env.example` to deployment secret storage and fill every required
value. `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` are **R2 S3 API
credentials**, not a Cloudflare API token. `R2_PUBLIC_BASE_URL` must be the R2
bucket custom domain which serves immutable objects.

`R2_PUBLIC_BASE_URL` is used for every ordinary asset. The launch Hermes bundle
intentionally uses the API URL: Expo sends `A-IM: bsdiff` only when it fetches
that asset, so the API must select between the immutable full object and the
immutable patch object. This is standard HTTP content negotiation, not a
Cloudflare Worker dependency.

## Deployment

Build `apps/update-server/Dockerfile`, then run `docker compose up -d` behind
an HTTPS reverse proxy. The one-shot `migrate` service uses embedded Goose
migrations, protects them with a PostgreSQL advisory lock, and must complete
before API and patch worker start. The `worker` is deliberately a separate
process: bsdiff is CPU/memory intensive and must not delay manifest responses.
The Docker build pins Expo's `bsdiff` source and fails if it cannot produce a
`BSDIFF40` patch which its paired `bspatch` reconstructs byte-for-byte.
Patch claims have a ten-minute lease, so an interrupted worker cannot leave a
channel permanently stuck in `processing`; clients keep receiving full bundles
until a replacement worker completes the job.

Required deployment settings are all listed in [`.env.example`](.env.example):

- `POSTGRES_PASSWORD` and `DATABASE_URL`
- `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BASE_URL`, `PUBLIC_BASE_URL`
- independent `ADMIN_TOKEN` and `INSTALLATION_HMAC_KEY`

`R2_ENDPOINT` is only for MinIO/S3-compatible local tests. `CODE_SIGNING_*` is
required only after the native app is configured to expect Expo code signing.

## Publish and operations

The developer-facing hot-update CLI is TypeScript, so it can call Expo's own
`@expo/fingerprint` library and retain its complete source report. From
`apps/mobile` run:

```sh
pnpm hot-update
```

It interactively asks for the channel, release message and missing server
credentials, warns before publishing a dirty worktree, runs `expo export`,
exports the public Expo config, generates the Android fingerprint, and uploads
the archive. Its only Git provenance is `commit_sha` plus
`working_tree_clean`. When a fingerprint is uploaded, its complete `{ hash,
sources }` is stored with the update group and its hash must equal the supplied
`runtimeVersion`. `--no-fingerprint` instead requires an explicit
`--runtime-version` and stores no fingerprint record.

CI uses the exact same command non-interactively:

```sh
pnpm hot-update -- publish --non-interactive --channel production --message "..."
```

Non-interactive publishing rejects a dirty checkout unless `--allow-dirty` is
specified explicitly. A new release creates one asynchronous bsdiff job from
the previous visible channel head to the new head for each compatible platform.
Until it is `ready`, clients receive the complete immutable bundle.

The hot-update CLI calls `createFingerprintAsync(projectDir, { platforms:
['android'] })`, rather than shelling out to EAS CLI. This keeps the generated
runtime hash and the human-debuggable source list from the same library call.

The independent `apps/update-client` CLI issues Expo-style manifest requests,
downloads and verifies returned assets, and posts versioned test event envelopes.
Pass `--current-update-id <uuid>` to `check` to exercise a ready bsdiff response;
the CLI checks the `226`, `IM: bsdiff`, and `BSDIFF40` invariants.

All management operations are provided by the interactive TypeScript CLI (and
support `--json` for scripting):

```sh
pnpm --dir apps/hot-update-cli start -- list --server https://updates.example --token ...
pnpm --dir apps/hot-update-cli start -- channel --action history --channel production --server https://updates.example --token ... --json
pnpm --dir apps/hot-update-cli start -- insights --server https://updates.example --token ... --json
pnpm --dir apps/hot-update-cli start -- source --action compare --from <from-group> --to <to-group> --server https://updates.example --token ...
```

`source compare` retains compatibility with earlier detailed provenance, while
new publications are intentionally limited to the single recorded commit. The
`insights` command exposes client outcomes plus full
and bsdiff request counts, bytes, saved bytes, hit rate, and fallbacks.

The complete management surface is also generated as OpenAPI 3.1 from the
existing Chi router. It uses the same `Authorization: Bearer <ADMIN_TOKEN>`
authentication as every other `/admin` route:

```text
GET /admin/openapi.json
GET /admin/openapi.yaml
GET /admin/docs
```

The public Expo protocol routes under `/api` intentionally stay outside this
document; their multipart and content-negotiation contracts remain unchanged.

## Observability

PostgreSQL is the metrics backend; this service deliberately does not expose a
Prometheus endpoint or require an OTel collector. Request counts, 5xx errors,
and duration are rolled into one-minute `service_metric_minutes` buckets.
Launch-bundle and bsdiff deliveries are similarly aggregated in
`delivery_metric_minutes`; ordinary update assets deliberately stay on the R2
custom domain and are not counted by the API.

Authenticated WebUI consumers can query:

```text
GET /admin/metrics/service?start=<RFC3339>&end=<RFC3339>&route=<optional>
GET /admin/metrics/delivery?start=<RFC3339>&end=<RFC3339>&channel=<optional>&group_id=<optional>
GET /admin/insights/activity?start=<RFC3339>&end=<RFC3339>&channel=<optional>
GET /admin/insights/groups/<group-id>/lifecycle?start=<RFC3339>&end=<RFC3339>
```

Both endpoints default to the last seven days and accept at most 90 days.
Raw client lifecycle events are retained for 35 days; minute metrics for 90
days. The worker performs retention cleanup daily. `activity` is deduplicated
per installation HMAC, running update, app version, and day. `launch_succeeded`
or `launch_healthy` creates one known launch per installation/update;
`launch_failed` or `launch_crashed` creates one known crash. Client
activity/version charts and these conservative lifecycle counts are emitted by
the mobile OTA integration. Production builds request manifests from
`https://updates.bbplayer.roitium.com/api/manifest` and post telemetry to the
same origin's `/api/events`; deploy the API at that origin before shipping such
a build.

## Integration verification

`docker compose -f docker-compose.e2e.yml up -d` starts PostgreSQL 17 and
MinIO. Then run:

```sh
E2E_DATABASE_URL='postgres://updates:updates-test@127.0.0.1:55432/updates?sslmode=disable' \
  go test ./internal/server -run TestE2EExpoProtocol -count=1 -v
```

The suite simulates Expo manifest and asset requests, validates immutable asset
hashes, validates the versioned event envelope, and proves event idempotency.
