# Environment reference

Reference for PickFlick's configuration, runtime contracts, CI, images, and Compose files. To run
the app, see [Develop locally](local-development.md); for deployed environments, see the
[UAT](uat-operations.md) and [production](production-operations.md) guides.

## Runtime variables

The backend validates these at startup with one zod schema (`@pickflick/config`). Errors name the
variable, never its value.

| Variable                                           | Contract                                                                                                                       | Secret |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `APP_ENV`                                          | `local`, `test`, `uat`, or `production`. Production hides `/ui-preview` and `/shell-preview`.                                  | No     |
| `SOURCE_REVISION`                                  | Optional full Git SHA; images set it and `/health/live` reports it.                                                            | No     |
| `BACKEND_HOST`, `BACKEND_PORT`                     | Backend bind address and port.                                                                                                 | No     |
| `DATABASE_URL`                                     | `postgres(ql)://` URL with host and database.                                                                                  | Yes    |
| `REDIS_URL`                                        | Required `redis://` or `rediss://` URL with a host. API and deadline worker use it only for notification invalidation.         | Yes    |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`               | S3 API URL and signing region (`us-east-1` for MinIO).                                                                         | No     |
| `STORAGE_BUCKET`                                   | Lowercase S3 bucket name.                                                                                                      | No     |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`         | Application storage credentials.                                                                                               | Yes    |
| `STORAGE_FORCE_PATH_STYLE`                         | `true` for MinIO, `false` for AWS S3.                                                                                          | No     |
| `RESEND_DELIVERY_MODE`                             | `disabled` (local/test), `preview` (synthetic preview), `live` (UAT/production).                                               | No     |
| `RESEND_API_KEY`                                   | Sending-only key, or `local-disabled` / `preview-disabled`.                                                                    | Yes    |
| `RESEND_WEBHOOK_SECRET`                            | Resend endpoint signing secret; required by the API in live mode, blank in local/test/preview.                                 | Yes    |
| `RESEND_FROM`                                      | Exact sender per environment (see below).                                                                                      | No     |
| `CONTACT_DELIVERY_TO`                              | Contact and final email-failure alert inbox: `hello@pick-flick.app` in production; approved test inbox in UAT.                 | Yes\*  |
| `AUTH_BASE_URL`                                    | Canonical public origin; HTTPS in UAT and production.                                                                          | No     |
| `AUTH_SECRET`                                      | At least 32 characters.                                                                                                        | Yes    |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`         | Google OAuth client for this environment.                                                                                      | Yes    |
| `APPLE_SIGN_IN_ENABLED`                            | Default `false`; the backend registers Apple and the frontend shows it only when `true`.                                       | No     |
| `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` | Required only when Apple is enabled.                                                                                           | Yes    |
| `APPLE_PRIVATE_KEY`                                | EC P-256 PKCS#8 PEM (`\n` line breaks accepted); required only when enabled.                                                   | Yes    |
| `CATALOG_PROVIDER`                                 | `poiskkino-thetvdb` (default) or `tmdb`; determines the injected catalog adapter.                                              | No     |
| `CATALOG_LOCALE`                                   | `en-US` only initially; unsupported locales fail validation.                                                                   | No     |
| `CATALOG_ENABLED`                                  | Default `false`; enables all sources of the selected adapter.                                                                  | No     |
| `CATALOG_TIMEOUT_MS`                               | Shared request/body timeout, 100–30000 ms; default 5000.                                                                       | No     |
| `POISKKINO_API_KEY`                                | Server-held X-API-KEY, required when PoiskKino is enabled.                                                                     | Yes    |
| `THETVDB_READ_TOKEN`                               | Server-held TheTVDB v4 bearer token, required when enabled; refresh/provision through the provider's login flow before expiry. | Yes    |
| `TMDB_READ_TOKEN`                                  | Server-held TMDB API read access token, required when enabled. Never a browser variable.                                       | Yes    |
| `CATALOG_REFRESH_HOURS`                            | Cache freshness age, 1–720 hours; default 24. The worker cadence decision is pending ADR-016.                                  | No     |
| `CATALOG_STALE_HOURS`                              | Maximum total cache age for explicit transient-failure fallback, 1–2160 hours and at least the refresh age; default 168.       | No     |

\* Except the published production address.

The frontend server also reads `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:3001`) to reach
the backend. `compose.local.yaml` reads `POSTGRES_*`, `REDIS_PORT`, `MINIO_ROOT_*`, and `MINIO_*_PORT`; they are not
application variables.

Auth credentials stay in the backend: never expose them to the browser, logs, screenshots, or rendered
Compose output. Each environment has its own Google client whose redirect URI is exactly
`${AUTH_BASE_URL}/api/auth/callback/google`, with no JavaScript origins. Apple needs owner approval
of the Apple Developer Program before it is enabled anywhere; the backend signs Apple's client
secret from the `.p8` key at startup, so an invalid key fails validation.

## Email identities

Fixed by [ADR-009](decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders):

| Environment | `RESEND_FROM`                              | Delivery                                              |
| ----------- | ------------------------------------------ | ----------------------------------------------------- |
| Local, test | `PickFlick <pickflick@example.invalid>`    | Disabled; messages are logged, never sent             |
| Preview     | `PickFlick UAT <uat@pick-flick.app>`       | `preview` mode; nothing is sent                       |
| UAT         | `PickFlick UAT <uat@pick-flick.app>`       | Live, separate UAT key restricted to `pick-flick.app` |
| Production  | `PickFlick <notifications@pick-flick.app>` | Live, key restricted to `pick-flick.app`              |

Startup rejects any other sender or mode for UAT and production. Contact messages are sent
directly with `Reply-To` set to the visitor when they give an address; a delivery failure answers
`503` and nothing is stored. Google Workspace receives `hello@pick-flick.app`; Alex owns Cloudflare
DNS, Google Workspace, and Resend. Never configure a personal fallback address.

The owner-approved UAT sender is an alias on the same `pick-flick.app` domain as production
(ADR-009 amendment, 2026-10-28). Keep separate sending-only keys for each environment; the shared
domain does not provide sender-level credential isolation. The approved notification test recipient
for #62 is `test@pick-flick.app`. Preview mode never sends email. Update the deployed UAT
`RESEND_FROM` before starting a revision that requires the new alias; repository changes do not
update Dokploy or Resend configuration.

Club avatars are private objects under `club-avatars/`: PNG, JPEG, or WebP up to 512 KiB, type
checked against the file signature, readable only by active members.

The separate email worker reads only `APP_ENV`, `DATABASE_URL`, `AUTH_BASE_URL`,
`RESEND_DELIVERY_MODE`, `RESEND_API_KEY`, `RESEND_FROM` and `CONTACT_DELIVERY_TO`. It receives no OAuth,
storage, Redis or webhook signing credentials. The live Compose worker waits for API readiness;
the API rejects a missing `RESEND_WEBHOOK_SECRET`. Local/test/preview dispatch leaves delivery jobs
pending. See [Email delivery operations](email-delivery.md) for setup, status counts and alert limits.

## Health, errors, and logs

All catalog adapters are disabled in the synthetic preview. Deployment Compose passes source
credentials/timeouts and provider-independent cache policy to the backend only. No credentials
are provisioned by this change. Adapter requests use fixed HTTPS endpoints, credentials in headers,
reject redirects, and return safe reason codes without response bodies or raw fetch diagnostics.

To switch providers, set `CATALOG_PROVIDER`, set `CATALOG_ENABLED=true`, supply that adapter's credentials, and fill missing
verified `MovieExternalId` mappings while retaining `movieId`. Never invent correspondences from
title/year. The new migration retains UUIDs and legacy mappings while invalidating old TMDB JSON
caches. Conflicting legacy IMDb mappings require reconciliation before migration. See
[ADR-017](decisions/README.md#adr-017--keep-movie-identity-independent-of-catalog-sources).
The per-source enable and timeout variables are replaced by `CATALOG_ENABLED` and
`CATALOG_TIMEOUT_MS`; only the selected adapter requires credentials.

The previous `TMDB_REFRESH_HOURS`/`TMDB_STALE_HOURS` variables are replaced by the catalog variables;
update deployed environment values when applying this migration.

| Endpoint (public path `/api/…`) | Answer                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `GET /health/live`              | `200 {"status":"alive","revision":"<sha>"}`; never touches dependencies.       |
| `GET /health/ready`             | `200` with `database` and `objectStorage` `up`, else `503`; two-second probes. |

Errors use one envelope; `reason` appears only for stable conflict codes such as
`ADMIN_CLUB_LIMIT_REACHED`:

```json
{ "error": { "code": "CONFLICT", "message": "…", "requestId": "…", "reason": "CLUB_ARCHIVED" } }
```

Codes come from `API_ERROR_CODES` in `@pickflick/contracts`. Every response carries
`x-request-id`: a caller's UUID is reused, anything else is replaced. Logs are nestjs-pino JSON with
`service`, `environment`, and the request ID; cookies, authorization headers, and `set-cookie` are
redacted. Request URLs, referrers, and redirect locations are also redacted because they can carry
invitation tokens. Provider logging preserves severity with a fixed event message and omits raw
provider messages and error arguments. Log operational metadata, never message bodies or personal
data. When the backend cannot start (`configuration.invalid`, `service.start.failed`) or meets an
unhandled promise rejection (`process.unhandled_rejection`), it writes one `fatal` JSON line to stderr
and exits with status 1.

## Continuous integration

[`ci.yml`](../.github/workflows/ci.yml) runs on pull requests and pushes to `main` with the locked
toolchain:

- **Secret scan** — gitleaks over history.
- **Dependency security** — `pnpm security:audit` (production dependencies, high and critical;
  see [Security](security.md)), independently of the static checks.
- **Lint, type-check, test** — ESLint, Stylelint, knip, Prettier, `tsc`,
  Vitest, workspace build, artifact drift.
- **Integration** — `pnpm deploy:check`, isolated PostgreSQL, Redis and MinIO, migrations, seed,
  `pnpm test:integration`, `pnpm test:e2e` against the built frontend and backend, and
  `pnpm test:journeys` (browser journeys through the real web app and API). CI layers
  `compose.ci.yaml` over the local file; both use the same pinned MinIO images.
- **UI** — one matrix job on the digest-pinned Linux Playwright image. PRs run `smoke`
  (`pnpm test:ui:smoke`: security headers, CSP, public accessibility and interaction, product
  navigation, 1024px overflow). `main` pushes and manual runs run `contract`
  (`pnpm test:ui:contract`: accessibility, interaction, CSP, responsive behavior) and `visual`
  (`pnpm test:ui:visual`). Failures upload screenshots, diffs, traces, and the HTML report.
- **Images** — `pnpm build:images`.

A terminal `Delivery gate` job always requires successful secret scan, dependency security, static,
integration, image, and UI jobs; the UI matrix picks its suites from the event. UAT deployment waits for a
successful `main` push CI run, including visual regression. The production image build remains on
PRs because it verifies all four release targets; path gating would remove that check from some
code changes without equivalent release-image evidence.

[Dependabot](../.github/dependabot.yml) opens weekly grouped updates for npm packages and GitHub
Actions. When Prisma pins a vulnerable transitive package, `overrides` in `pnpm-workspace.yaml`
forces the fixed version; remove the entry once Prisma catches up.

## Images and Compose

`Dockerfile` builds four targets from the locked workspace: `frontend` (Next.js standalone, port
3000), `backend` (NestJS, port 3001, exports the embedded `SOURCE_REVISION`), `worker` (backend package, independent deadline entrypoint, no public port), and `release` (runs
migrations, then the required seed step). `pnpm build:images` builds them from a clean checkout and tags them
with the short revision.

| File                   | Purpose                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose.local.yaml`   | Local PostgreSQL, Redis and MinIO.                                                                                                                   |
| `compose.ci.yaml`      | MinIO image and health-check overrides for isolated CI integration, matching the local and preview pins.                                             |
| `compose.deploy.yaml`  | UAT and production: `release`, `backend`, `worker`, `frontend` and ephemeral Redis. Dokploy manages PostgreSQL/storage.                              |
| `compose.preview.yaml` | Pre-UAT previews: the same app plus PostgreSQL, Redis and MinIO, `preview` email, loopback ports `PREVIEW_BACKEND_PORT` and `PREVIEW_FRONTEND_PORT`. |

Local and preview MinIO use the exact digest-pinned `cgr.dev/chainguard/minio` and
`cgr.dev/chainguard/minio-client` pair already selected in `compose.ci.yaml`, replacing the
inaccessible Quay release tags. Sharing these pins keeps CI, local development, and previews on
the same tested storage binaries. These are
[Chainguard's Wolfi-based MinIO images](https://edu.chainguard.dev/chainguard/containers/getting-started/web-and-data-services/minio/);
their OCI labels identify Chainguard as vendor and link its image sources.

Verified on 2026-10-02 with registry pulls and actual containers on Linux amd64: the server reports
`RELEASE.2026-09-22T19-25-18Z` (Wolfi package `0.20260922.192518-r0`); the client reports
`DEVELOPMENT.GOGET`, with Wolfi package `mc` version `0.20250813.083541-r24`. Both run as UID 65532.
The server includes wget rather than curl, so its healthcheck uses CI's
`wget --quiet --spider` against the same `/minio/health/live` endpoint with unchanged timing.
Isolated local and preview dependency stacks passed their unmodified shell bucket initializers,
repeated initialization, S3 put/get/delete, and object persistence across server recreation.
Their test containers, volumes, and networks were removed afterward.

`pnpm deploy:check` renders all three with synthetic values. In `compose.deploy.yaml`, `release`
must finish before `backend` and `worker` start, and `frontend` waits for backend health. Application containers are
read-only and drop all capabilities. No deployment service publishes host ports. Dokploy supplies `DATABASE_URL` and the
storage values; every service joins Dokploy's shared `dokploy-network` under an alias such as
`pickflick-uat-backend`. UAT and production use separate projects, credentials, buckets, and Resend
identities. Never save rendered Compose output; it contains secrets.

`pnpm deploy:uat` converges `compose.deploy.yaml` for UAT from a clean workstation checkout;
production is deployed only by its workflow.

### Deployment settings in GitHub

| Setting                         | Where                             | Purpose                                     |
| ------------------------------- | --------------------------------- | ------------------------------------------- |
| `DOKPLOY_URL`                   | Actions variable                  | Dokploy API origin behind Cloudflare Access |
| `DOKPLOY_UAT_COMPOSE_ID`        | Actions variable                  | UAT Compose resource                        |
| `DOKPLOY_PRODUCTION_COMPOSE_ID` | `production` environment variable | Production Compose resource                 |
| `DOKPLOY_API_TOKEN`             | Secret (per environment)          | Compose read/deploy access                  |
| `CF_ACCESS_CLIENT_ID`/`_SECRET` | Secret (per environment)          | Cloudflare Access service token             |
| `PRODUCTION_DEPLOY_ENABLED`     | Repository variable               | Production runs only when exactly `true`    |

## Preview authentication

Previews use a dedicated **PickFlick Preview** Google client with redirect URI
`${AUTH_BASE_URL}/api/auth/callback/google` and Apple disabled. Supply `AUTH_BASE_URL`,
`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` through the preview's secret store; do
not supply Apple values while `APPLE_SIGN_IN_ENABLED=false`.

## Nomination deadline worker

The worker validates `APP_ENV` and `DATABASE_URL` through the database schema, plus `REDIS_URL`
through the notification signal schema. Database-only migration tools do not require Redis.
Run `pnpm start:worker` after building and migrating; `pnpm dev` and `pnpm start` include the worker.
`pnpm test:worker` checks built-process overdue decisions, restart idempotence and graceful shutdown
against a positively identified local/test database. CI runs it after migration, seeding and integration tests.

The worker polls every five seconds and processes database-only transactions sequentially.
`deadline.cycle` records each cycle's due count; `deadline.outcome` and `deadline.stale` identify
Sessions and deadline versions.
Outcome events include `latenessMs`. `deadline.failure` and `deadline.cycle.failed` omit raw exceptions;
inspect PostgreSQL health and schema compatibility when they recur. Due Sessions remain retryable.
Archived Clubs pause. Completed empty decisions are preserved until the deadline changes.

Compose checks `/tmp/pickflick-deadline-worker` every five seconds; a heartbeat older than thirty
seconds fails health. The worker writes it after a completed cycle, with mode 0600 and symlink following
disabled. Each container has its own tmpfs. SIGTERM/SIGINT stop new work and finish the current
transaction before Prisma disconnects. Decision/recipient records are durable intent; notification
transport and inbox delivery are not implemented.

## Session progress

`GET /sessions/:sessionId/progress` returns the committed progress version to current Club members
with `Cache-Control: private, no-store`. The Session page polls it every five seconds while visible
and on focus and online events; a failed poll shows feedback and the next poll retries.
Migration 19 must precede updated API and worker images. There is no new service, runtime variable
or notification transport; the PostgreSQL outbox retains later notification intent.

## Notification invalidation broker

`REDIS_URL` is required for the backend and deadline worker. Local defaults use loopback port
16379 (`REDIS_PORT` changes the Compose host binding). CI starts its own Redis alongside the
isolated database and storage. Preview uses its Compose-local Redis; deployment definitions use
an environment-specific internal Redis alias with no host port. These definitions do not authorize
deployment or production provisioning.

Redis stores no inbox state; persistence is disabled. PostgreSQL commits remain successful during
broker outages. The publisher bounds commands to 500ms, skips offline sends, and logs a safe
warning. The client reconnects and restores subscriptions. Reconciliation reads persisted REST
state on initial connection, reconnect, focus and every five minutes. Heartbeats every thirty
seconds recheck stream authorization without causing REST requests. No Redis queue, Streams,
cache, outbox or notification replay is configured.
