# Environment reference

Reference for PickFlick's configuration, runtime contracts, CI, images, and Compose files. To run
the app, see [Develop locally](local-development.md); for deployed environments, see the
[UAT](uat-operations.md) and [production](production-operations.md) guides.

## Runtime variables

The backend validates these at startup with one zod schema (`@pickflick/config`). Errors name the
variable, never its value.

| Variable                                           | Contract                                                                                      | Secret |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `APP_ENV`                                          | `local`, `test`, `uat`, or `production`. Production hides `/ui-preview` and `/shell-preview`. | No     |
| `SOURCE_REVISION`                                  | Optional full Git SHA; images set it and `/health/live` reports it.                           | No     |
| `BACKEND_HOST`, `BACKEND_PORT`                     | Backend bind address and port.                                                                | No     |
| `DATABASE_URL`                                     | `postgres(ql)://` URL with host and database.                                                 | Yes    |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`               | S3 API URL and signing region (`us-east-1` for MinIO).                                        | No     |
| `STORAGE_BUCKET`                                   | Lowercase S3 bucket name.                                                                     | No     |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`         | Application storage credentials.                                                              | Yes    |
| `STORAGE_FORCE_PATH_STYLE`                         | `true` for MinIO, `false` for AWS S3.                                                         | No     |
| `RESEND_DELIVERY_MODE`                             | `disabled` (local/test), `preview` (synthetic preview), `live` (UAT/production).              | No     |
| `RESEND_API_KEY`                                   | Sending-only key, or `local-disabled` / `preview-disabled`.                                   | Yes    |
| `RESEND_FROM`                                      | Exact sender per environment (see below).                                                     | No     |
| `CONTACT_DELIVERY_TO`                              | Contact inbox: `hello@pick-flick.app` in production, an approved test inbox in UAT.           | Yes\*  |
| `AUTH_BASE_URL`                                    | Canonical public origin; HTTPS in UAT and production.                                         | No     |
| `AUTH_SECRET`                                      | At least 32 characters.                                                                       | Yes    |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`         | Google OAuth client for this environment.                                                     | Yes    |
| `APPLE_SIGN_IN_ENABLED`                            | Default `false`; the backend registers Apple and the frontend shows it only when `true`.      | No     |
| `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` | Required only when Apple is enabled.                                                          | Yes    |
| `APPLE_PRIVATE_KEY`                                | EC P-256 PKCS#8 PEM (`\n` line breaks accepted); required only when enabled.                  | Yes    |

\* Except the published production address.

The frontend server also reads `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:3001`) to reach
the backend. `compose.local.yaml` reads `POSTGRES_*`, `MINIO_ROOT_*`, and `MINIO_*_PORT`; they are not
application variables.

Auth credentials stay in the backend: never expose them to the browser, logs, screenshots, or rendered
Compose output. Each environment has its own Google client whose redirect URI is exactly
`${AUTH_BASE_URL}/api/auth/callback/google`, with no JavaScript origins. Apple needs owner approval
of the Apple Developer Program before it is enabled anywhere; the backend signs Apple's client
secret from the `.p8` key at startup, so an invalid key fails validation.

## Email identities

Fixed by [ADR-009](decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders):

| Environment | `RESEND_FROM`                                      | Delivery                                     |
| ----------- | -------------------------------------------------- | -------------------------------------------- |
| Local, test | `PickFlick <pickflick@example.invalid>`            | Disabled; messages are logged, never sent    |
| Preview     | `PickFlick UAT <notifications@uat.pick-flick.app>` | `preview` mode; nothing is sent              |
| UAT         | `PickFlick UAT <notifications@uat.pick-flick.app>` | Live, key restricted to `uat.pick-flick.app` |
| Production  | `PickFlick <notifications@pick-flick.app>`         | Live, key restricted to `pick-flick.app`     |

Startup rejects any other sender or mode for UAT and production. Contact messages are sent
directly with `Reply-To` set to the visitor when they give an address; a delivery failure answers
`503` and nothing is stored. Google Workspace receives `hello@pick-flick.app`; Alex owns Cloudflare
DNS, Google Workspace, and Resend. Never configure a personal fallback address.

Club avatars are private objects under `club-avatars/`: PNG, JPEG, or WebP up to 512 KiB, type
checked against the file signature, readable only by active members.

## Health, errors, and logs

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
- **Lint, type-check, test** — `pnpm audit` at high severity, ESLint, Stylelint, knip, Prettier, `tsc`,
  Vitest, workspace build, artifact drift.
- **Integration** — `pnpm deploy:check`, isolated PostgreSQL and MinIO, migrations, seed,
  `pnpm test:integration`, and `pnpm test:e2e` against the built frontend and backend. CI layers
  `compose.ci.yaml` over the local file; both use the same pinned MinIO images.
- **UI smoke** — six tagged checks with `pnpm test:ui:smoke` on PRs, covering security headers,
  CSP, public accessibility and interaction, product navigation, and 1024px overflow.
- **UI contract** — the full `pnpm test:ui:contract` selection on `main` pushes and manual CI runs,
  including accessibility, interaction, CSP, and responsive behavior checks.
- **UI visual** — `pnpm test:ui:visual` on `main` pushes and manual CI dispatches. All UI jobs use
  the same digest-pinned Linux Playwright image; failures upload screenshots, diffs, traces, and
  the HTML report.
- **Images** — `pnpm build:images`.

A terminal `Delivery gate` job requires the smoke job and skipped full UI jobs on PRs. On `main`
pushes and manual runs, it requires both full UI jobs and a skipped smoke job. UAT deployment waits for a
successful `main` push CI run, including visual regression. The production image build remains on
PRs because it verifies all three release targets; path gating would remove that check from some
code changes without equivalent release-image evidence.

[Dependabot](../.github/dependabot.yml) opens weekly grouped updates for npm packages and GitHub
Actions. When Prisma pins a vulnerable transitive package, `overrides` in `pnpm-workspace.yaml`
forces the fixed version; remove the entry once Prisma catches up.

## Images and Compose

`Dockerfile` builds three targets from the locked workspace: `frontend` (Next.js standalone, port
3000), `backend` (NestJS, port 3001, exports the embedded `SOURCE_REVISION`), and `release` (runs
migrations, then the required seed step). `pnpm build:images` builds them from a clean checkout and tags them
with the short revision.

| File                   | Purpose                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose.local.yaml`   | Local PostgreSQL and MinIO.                                                                                                                   |
| `compose.ci.yaml`      | MinIO image and health-check overrides for isolated CI integration, matching the local and preview pins.                                      |
| `compose.deploy.yaml`  | UAT and production: `release`, `backend`, `frontend`. Dokploy manages the data services.                                                      |
| `compose.preview.yaml` | Pre-UAT previews: the same app plus PostgreSQL and MinIO, `preview` email, loopback ports `PREVIEW_BACKEND_PORT` and `PREVIEW_FRONTEND_PORT`. |

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
must finish before `backend` starts, and `frontend` waits for backend health. Containers are
read-only, drop all capabilities, and publish no host ports. Dokploy supplies `DATABASE_URL` and the
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
