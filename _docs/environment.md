# Environment and runtime operations

How PickFlick is configured and run locally, in CI, in previews, and in deployed environments.
Live UAT and production procedures live in the [UAT](uat-operations.md) and
[production](production-operations.md) guides.

## Start locally

Use the Node and pnpm versions pinned in `.node-version` and `package.json`. The checked-in values
are synthetic.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm services:up
pnpm migrate
pnpm seed
pnpm dev
```

- `pnpm services:up` starts PostgreSQL and MinIO from `compose.local.yaml` and creates the bucket.
  Host ports avoid the defaults: PostgreSQL `15432`, MinIO `19000` (API) and `19001` (console);
  every port binds to `127.0.0.1`.
- `pnpm services:check` confirms PostgreSQL answers and MinIO is live.
- `pnpm services:down` stops the containers and keeps their volumes.
- Open `http://127.0.0.1:3000`, which matches `AUTH_BASE_URL` and the local Google callback.
- The API dev command rebuilds with `tsc` and restarts under `nodemon`; `tsx` cannot run the Nest
  app because it does not emit decorator metadata.

Processes read `.env` from the repository root without overriding variables already set. Set
`PICKFLICK_ENV_FILE` to use a different file.

## Database commands

- `pnpm migrate` runs `prisma migrate deploy` over the nine reviewed migrations; never `db push`.
- `pnpm seed` is idempotent, uses stable IDs and `example.invalid` addresses, and runs only when
  `APP_ENV` is `local` (database `pickflick_local` on a loopback host) or `test`
  (`pickflick_test`).
- `pnpm db:reset` is destructive and applies the same guards before `prisma migrate reset`.
- `pnpm test:integration` runs the `*.int.spec.ts` suites (database constraints, auth, Clubs)
  against the local services.

## Runtime variables

The API validates these at startup with one zod schema (`@pickflick/config`). Errors name the
variable, never its value.

| Variable                                           | Contract                                                                                      | Secret |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `APP_ENV`                                          | `local`, `test`, `uat`, or `production`. Production hides `/ui-preview` and `/shell-preview`. | No     |
| `SOURCE_REVISION`                                  | Optional full Git SHA; images set it and `/health/live` reports it.                           | No     |
| `API_HOST`, `API_PORT`                             | API bind address and port.                                                                    | No     |
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
| `APPLE_SIGN_IN_ENABLED`                            | Default `false`; the API registers Apple and the web shows it only when `true`.               | No     |
| `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` | Required only when Apple is enabled.                                                          | Yes    |
| `APPLE_PRIVATE_KEY`                                | EC P-256 PKCS#8 PEM (`\n` line breaks accepted); required only when enabled.                  | Yes    |

\* Except the published production address.

The web server additionally reads `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:3001`) to reach
the API. `compose.local.yaml` reads `POSTGRES_*`, `MINIO_ROOT_*`, and `MINIO_*_PORT`; they are not
application variables.

Auth credentials stay in the API: never expose them to the browser, logs, screenshots, or rendered
Compose output. Each environment has its own Google client whose redirect URI is exactly
`${AUTH_BASE_URL}/api/auth/callback/google`, with no JavaScript origins. Apple needs owner approval
of the Apple Developer Program before it is enabled anywhere; the API signs a short-lived client
secret from the `.p8` key at startup.

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
redacted. Log operational metadata, never message bodies or personal data.

## Continuous integration

[`ci.yml`](../.github/workflows/ci.yml) runs on pull requests and pushes to `main` with the locked
toolchain:

- **Secret scan** — gitleaks over history.
- **Lint, type-check, test** — ESLint, Prettier, `tsc`, Vitest, workspace build, artifact drift.
- **Integration** — `pnpm compose:check`, isolated PostgreSQL and MinIO, migrations, seed,
  `pnpm test:integration`, and `pnpm e2e:smoke` against the built web and API.
- **UI** — `pnpm ui:test`; failures upload screenshots, diffs, traces, and the HTML report.
- **Images** — `pnpm images:build`.

A terminal `Delivery gate` job requires all of them; UAT deployment waits for it.

## Images and Compose

`Dockerfile` builds three targets from the locked workspace: `web` (Next.js standalone, port 3000),
`api` (NestJS, port 3001, exports the embedded `SOURCE_REVISION`), and `release` (runs migrations,
then the required seed step). `pnpm images:build` builds them from a clean checkout and tags them
with the short revision.

| File                   | Purpose                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `compose.local.yaml`   | Local PostgreSQL and MinIO.                                                                                                   |
| `compose.deploy.yaml`  | UAT and production: `release`, `api`, `web`. Data services are managed by Dokploy.                                            |
| `compose.preview.yaml` | Pre-UAT previews: the same app plus PostgreSQL and MinIO, `preview` email, loopback ports `BACKEND_PORT` and `FRONTEND_PORT`. |

`pnpm compose:check` renders all three with synthetic values. In `compose.deploy.yaml`, `release`
must finish before `api` starts and `web` waits for API health; containers are read-only, drop all
capabilities, and expose no host ports. Dokploy supplies `DATABASE_URL` and the storage values; every
service joins Dokploy's shared `dokploy-network` under an environment-specific alias. UAT and production use separate projects,
credentials, buckets, and Resend identities. Never save rendered Compose output; it
contains secrets.

`pnpm deploy:compose` converges `compose.deploy.yaml` for UAT from a clean workstation checkout;
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
