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

`bbplayer-updates publish --server https://updates.example --token ... --channel production --dist apps/mobile/dist --message "..."`

`publish` refuses a dirty Git checkout, archives the export, and stores source
provenance alongside the update. A new release creates one asynchronous bsdiff
job from the previous visible channel head to the new head for each compatible
platform. Until it is `ready`, clients receive the complete immutable bundle.

For `runtimeVersion: { policy: 'fingerprint' }`, Expo config intentionally does
not contain a resolved runtime string. Generate it against the same source and
environment as the native build, then pass it explicitly:

```sh
runtime_version="$(npx --yes eas-cli@latest fingerprint:generate --platform android --json --non-interactive | jq -r '.hash')"
bbplayer-updates publish --runtime-version "$runtime_version" ...
```

The checked-in GitHub workflow performs this automatically. String and
`appVersion` runtime policies are resolved from `expoConfig.json` by the CLI.

The independent `apps/update-client` CLI issues Expo-style manifest requests,
downloads and verifies returned assets, and posts versioned test event envelopes.
Pass `--current-update-id <uuid>` to `check` to exercise a ready bsdiff response;
the CLI checks the `226`, `IM: bsdiff`, and `BSDIFF40` invariants.

Operational commands use tables by default and `--json` for scripting:

```sh
bbplayer-updates list --server https://updates.example --token ...
bbplayer-updates channel history production --server https://updates.example --token ... --json
bbplayer-updates insights --server https://updates.example --token ... --json
bbplayer-updates source compare <from-group> <to-group> --server https://updates.example --token ...
```

`source compare` includes the published commit candidates, a GitHub compare URL
when both groups are in the same GitHub repository, and metadata/config/launch
bundle hash values for each side. `insights` exposes client outcomes plus full
and bsdiff request counts, bytes, saved bytes, hit rate, and fallbacks.

## Integration verification

`docker compose -f docker-compose.e2e.yml up -d` starts PostgreSQL 17 and
MinIO. Then run:

```sh
E2E_DATABASE_URL='postgres://updates:updates-test@127.0.0.1:55432/updates?sslmode=disable' \
  go test ./internal/server -run TestE2EExpoProtocol -count=1 -v
```

The suite simulates Expo manifest and asset requests, validates immutable asset
hashes, validates the versioned event envelope, and proves event idempotency.
