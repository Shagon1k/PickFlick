# Environment and runtime operations

This reference defines the configuration implemented for the API, worker, database commands, local
data-service stack, production images, and proportional application deployment topology. Later
provider and provisioning issues extend this inventory when their consumers exist.

## Deployment images and Compose

`Dockerfile` builds four targets from the same locked workspace and full source revision:

| Target | Runtime | Default command |
| --- | --- | --- |
| `web` | Next.js standalone server on port 3000 | `node apps/web/server.js` |
| `api` | Compiled NestJS API on port 3001 | Load the embedded source revision, then run `node dist/main.js` |
| `worker` | Compiled worker process | Load the embedded source revision, then run `node dist/main.js` |
| `release` | One-shot database release gate | `node scripts/run-release.mjs` |

Run `pnpm images:build` from a clean Git checkout. The command passes the full Git revision into
each build, embeds it in the build output, and tags each local image with the first 12 revision
characters. When Git metadata is available, a configured `SOURCE_REVISION` must match `HEAD` and
does not bypass the clean-worktree check. `pnpm deploy:compose` resolves the clean checkout's `HEAD`
before Docker starts and passes it as the `SOURCE_REVISION` build argument, including from linked
worktrees. A Dokploy source build derives the same value from the checked-out Git `HEAD`. The Docker
context includes only the Git `HEAD` and local branch refs needed for the Dokploy fallback; it
excludes Git configuration, credentials, objects, and logs. The Dockerfile pins both Node base
images by multi-platform digest, pins the Dockerfile
frontend by digest, and installs from the committed pnpm lockfile.

The release image runs committed Prisma migrations before the production-safe required-seed step.
The required-seed step currently verifies database connectivity because no shared reference rows
exist. `compose.deploy.yaml` uses native Compose ordering: the one-shot `release` service completes
before API and worker startup, and web waits for API health. Each service builds its matching
Dockerfile target from the selected full revision. Run the guarded deployment command after
configuring the environment-specific values:

```bash
pnpm deploy:compose
```

The command runs Dokploy-compatible native Compose convergence. Docker Compose starts the one-shot
release service first; API and worker wait for it to exit successfully, and web waits for API health.
A failed release blocks the new runtime services. Standard Compose may replace running containers
during convergence, so this contract does not promise that a failed release preserves the prior
runtime revision.

Use `compose.deploy.yaml` for source-built UAT and production deployments. The local
`pnpm deploy:compose` command remains UAT-only so an operator cannot start production from a
workstation. GitHub Actions promotes production from a UAT-proven `main` revision by creating or
reusing an immutable SemVer tag and asking Dokploy to build that tag. Keep UAT and production in
separate Compose and Dokploy projects. Configure Dokploy to clone the selected Git ref and use
Docker Compose mode, not Docker Stack mode. Supply all runtime values from the environment-specific
Dokploy project and render the exact configuration before deployment:

```bash
pnpm compose:check
docker compose -f compose.deploy.yaml config --format json
```

`pnpm compose:check` validates managed-preview authentication inputs with
`docker compose config -q`, then renders synthetic UAT and production configurations and verifies
their static contract. It checks the exact application service set, runtime-required environment inputs,
source-revision build/runtime reporting, native release-to-runtime dependency ordering, the release
image target plus command/entrypoint inheritance, intended API/web health checks, web's API-health
dependency, private ports, environment-specific project names, uniquely owned service aliases that
are disjoint across environments, and retained container hardening.
It does not require image digests, application-owned PostgreSQL/Redis, a worker egress bridge, or
queue-drain timing. Provider resources, internal connectivity, port settings, and routing remain UAT
inspection work. The second command validates the complete operator-supplied configuration. Do not
save rendered output because it contains resolved secrets.

Dokploy supplies these Compose-only values. They do not belong in the local `.env` file:

| Variable | Contract |
| --- | --- |
| `DATABASE_URL` | Internal connection URL for that environment's Dokploy-managed PostgreSQL resource |
| `REDIS_URL` | Internal connection URL for that environment's Dokploy-managed Redis resource |
| `DOKPLOY_NETWORK` | Pre-created environment-specific application network shared with the managed data resources and Dokploy routing |

The remote Compose file owns only `release`, `api`, `worker`, and `web`; it defines no data service
or persistent volume. Every service joins the pre-created external application network with an
environment-specific alias. Web and API use `expose`; no service publishes a host port. The public
origin routes only to web, whose `/api/*` rewrite targets the environment-specific internal API
alias. Connect the environment's managed PostgreSQL, Redis, and MinIO resources to the same application network,
supply their internal connection values, and keep raw external ports disabled in Dokploy. UAT and
production must use different Dokploy projects, application networks, service aliases,
database/Redis credentials, storage buckets and credentials, and Resend identities. A separate
production deployment server is deferred until production provisioning, or until measured
contention or a host-isolation requirement justifies one earlier.

API and worker stop accepting new work on `SIGINT` or `SIGTERM`. They wait up to
`SHUTDOWN_TIMEOUT_MS` for shutdown work to finish. Deployment Compose fixes this timeout at 10
seconds under a 15-second stop grace. Add a configurable, queue-aware drain and coordinated grace
only when a real consumer supplies measured job-duration and retry requirements.

The [UAT operations guide](uat-operations.md) owns live UAT provisioning and delivery. After the `CI`
delivery gate succeeds for a push to `main`, `.github/workflows/deploy-uat.yml` serializes UAT runs,
checks out the triggering SHA, confirms that `main` has not advanced, and triggers the configured
Dokploy Compose resource. Dokploy auto deploy remains disabled. The workflow never creates
deployment tags, changes the resource Git branch, or writes the resource environment. The source
build derives `SOURCE_REVISION` from the checked-out Git metadata, and the API and worker images load
that embedded value at runtime. The workflow requires both Dokploy's completed deployment record
and the live API liveness response to report the triggering SHA before it runs desktop/mobile
browser smoke.

The [production operations guide](production-operations.md) owns dormant production provisioning,
manual promotion, migration compatibility, and rollback. `.github/workflows/promote-production.yml`
resolves current `main`, requires the `UAT E2E` job to have completed successfully in an
exact-revision UAT workflow run, and computes the next stable `vMAJOR.MINOR.PATCH` tag. Its deploy
job is unreachable unless the repository
variable `PRODUCTION_DEPLOY_ENABLED` is exactly `true`; the production controller repeats that guard
from the current repository variable after protected-environment approval and before reading Git or
Dokploy state. When enabled through a separately approved release, the workflow creates or reuses
the tag, keeps Dokploy automatic deployment disabled, pins the production resource to the tag, and
triggers one deployment. The controller accepts completion only when the correlated deployment
record reports the release SHA. If a later run finds the resource already pinned to that release,
it stops for manual reconciliation. This source-build path preserves source identity, not
byte-for-byte image identity; issue #115 remains deferred until separate build/deployment hosts or
another concrete artifact-identity requirement justifies registry publication.

The UAT workflow consumes these GitHub settings. They are deployment-control inputs, not
application runtime variables, and do not belong in `.env` or `.env.example`:

| Setting | GitHub storage | Sensitive | Purpose |
| --- | --- | --- | --- |
| `DOKPLOY_URL` | Actions variable | No | HTTPS origin for the Cloudflare-protected Dokploy API. |
| `DOKPLOY_UAT_COMPOSE_ID` | Actions variable | No | Exact UAT Compose resource identifier. |
| `DOKPLOY_API_TOKEN` | Actions secret | Yes | Least-privilege UAT Compose read/deploy access. |
| `CF_ACCESS_CLIENT_ID` | Actions secret | Yes | Cloudflare Access service-token identifier for the Dokploy API. |
| `CF_ACCESS_CLIENT_SECRET` | Actions secret | Yes | Cloudflare Access service-token secret for the Dokploy API. |
| `PLAYWRIGHT_BASE_URL` | Actions variable | No | Canonical UAT browser-smoke origin; must be `https://uat.pick-flick.app`. |
| `PRODUCTION_DEPLOY_ENABLED` | Repository variable | No | Fail-closed production guard; absent or any value except exact `true` disables deployment. |
| `DOKPLOY_PRODUCTION_COMPOSE_ID` | `production` environment variable | No | Exact dormant production Compose resource identifier. |

Production reuses `DOKPLOY_URL` and the three Dokploy/Cloudflare credentials, but scopes their
production values through the protected GitHub `production` environment. Those settings are not
required for a guard-disabled validation run. `GITHUB_REPOSITORY`, `GITHUB_API_URL`, and
`GITHUB_TOKEN` are ephemeral workflow inputs. They identify the trusted repository and let the
promotion controller read UAT workflow evidence; they are never saved to Dokploy.

## Email identities and ownership

[ADR-009](decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders)
fixes the non-secret email identity contract:

| Environment | Public contact | `RESEND_FROM` | Boundary |
| --- | --- | --- | --- |
| Local and test | None | `PickFlick <pickflick@example.invalid>` | `RESEND_DELIVERY_MODE=disabled` with `RESEND_API_KEY=local-disabled`; never call Resend. |
| UAT | None | `PickFlick UAT <notifications@uat.pick-flick.app>` | Deployed UAT fixes `RESEND_DELIVERY_MODE=live` and uses a separate sending-only key restricted to `uat.pick-flick.app`; synthetic content and approved test recipients only. |
| Production | `hello@pick-flick.app` | `PickFlick <notifications@pick-flick.app>` | Production fixes `RESEND_DELIVERY_MODE=live` and uses a separate sending-only key restricted to `pick-flick.app`; application replies go to the public contact queue. |

Startup validation requires the exact UAT and production sender values. The checked-in
`compose.preview.yaml` fixes `RESEND_DELIVERY_MODE=preview`, keeps its UAT-shaped sender, and uses
the non-secret `preview-disabled` placeholder. Deployed UAT and production fix the mode to `live`,
so their startup validation rejects disabled placeholders even when a key is inherited incorrectly.

Google Workspace receives public mail for `pick-flick.app`. Cloudflare owns authoritative DNS, and
Resend sends application email. Alex retains administrative ownership and recovery control for all
three providers. Do not publish or configure a personal fallback address.

The production notification adapter must set `Reply-To` to `hello@pick-flick.app`. Before release,
configure Google Workspace so direct mail to `notifications@pick-flick.app` reaches the same
owner-controlled queue. UAT does not need a Google Workspace mailbox for its sender address. A
provider failure must remain inside its environment: preserve retryable intent and report persistent
failure instead of selecting personal SMTP, UAT credentials, or another sender.

Contact delivery uses `CONTACT_DELIVERY_TO` for the environment-approved inbox and
`CONTACT_HASH_SECRET` to create non-reversible source and duplicate hashes. Production fixes the
destination to `hello@pick-flick.app`; UAT uses one explicitly approved synthetic-test recipient;
local and test use `example.invalid` and keep Resend disabled. Rotate the hash secret as a server
credential, understanding that rotation starts a new rate-limit and duplicate-detection window.

The exact From values and public address are safe to document. `RESEND_API_KEY`, provider recovery
material, and generated DNS verification values are not. Store each key only in its environment's
secret store and never save a rendered Compose environment as evidence.

## Start the local stack

Use the pinned Node and pnpm versions from the repository root. The checked-in values are synthetic
local defaults, not production credentials.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm services:up
pnpm migrate
pnpm seed
pnpm services:check
pnpm db:check
pnpm auth:check
pnpm dev
```

`pnpm services:up` waits for PostgreSQL, Redis, and MinIO, then creates the configured
MinIO bucket if it does not exist. `pnpm services:check` checks each service from the host and uses
the runtime storage credentials to verify access to the configured bucket. Local configuration uses
the non-secret `RESEND_API_KEY=local-disabled` placeholder and does not call Resend.
`pnpm db:check` verifies the migration history, migration upgrade compatibility, deterministic
fixtures, and PostgreSQL constraints. `pnpm auth:check` uses a deterministic local provider double
to prove new and returning Google identity handling, fixed identity-only permissions,
provider-credential discard, email-conflict denial, distinct Cloudflare client rate-limit keys,
database session resolution, sign-out/revocation, state/nonce/PKCE binding, atomic state
consumption, origin and return-target rejection, and safe expiry, replay, denial, invitation retry,
and forged-callback handling. It does not call Google or validate a real provider credential.

Stop the containers with `pnpm services:down`. That command retains the named volumes. Delete the
volumes only when you intentionally want to discard all local service data.

## Run migrations and seeds

`pnpm migrate` uses `prisma migrate deploy`; it never uses `db push`. The first two migrations
create the `User`, `Club`, `Membership`, and `Session` foundation and its reviewed constraints. The
third adds `ContactMessage` with duplicate, delivery-state, payload-lifecycle, and lookup
constraints. The fourth adds Google identity, database-session, verification-state, and auth
rate-limit records plus the provider-subject uniqueness constraint. All four migrations are
additive and backward compatible with the preceding application schema.

`pnpm seed` is idempotent and uses stable identifiers plus `example.invalid` email addresses. It
refuses every environment except `local` and `test`. A local seed also requires a loopback database
host, no driver-level host override, and the database name `pickflick_local`; a test seed requires
`pickflick_test`.

`pnpm db:reset` is destructive. It applies the same positive environment, host, and database-name
guards before invoking `prisma migrate reset`. Never use it against shared, UAT, or production data.

## Managed preview authentication

Managed previews use the dedicated **PickFlick Preview** Google OAuth web client. Supply these four
values through the managed preview environment or secret mechanism before Compose validation:

```text
AUTH_BASE_URL=https://preview-N.shagon1k.win
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Set `AUTH_BASE_URL` to the preview's canonical public origin. The Google client's authorized
redirect URI must exactly equal `${AUTH_BASE_URL}/api/auth/callback/google`. Keep Authorized
JavaScript origins empty: PickFlick performs the Google OAuth exchange on the server and does not
load Google's browser SDK. Add an origin only if a later approved direct browser-SDK flow requires
one.

`compose.preview.yaml` requires all four inputs; it contains no fallback authentication values.
`pnpm compose:check` validates the contract with synthetic values and `docker compose config -q`,
which emits no resolved configuration. Never save a rendered preview configuration, logs, or
screenshots containing `AUTH_SECRET` or `GOOGLE_CLIENT_SECRET`. Keep the client ID at the same
server-only configuration boundary.

Preview, UAT, and production use separate Google OAuth clients and secrets. Never copy preview
credentials into UAT or production.

## Runtime variables

The API and worker validate their runtime variables before starting. The worker does not require
the API-only bind settings. Validation errors name invalid variables but never echo their values.

| Variable | Type and allowed values | Consumer | Sensitive |
| --- | --- | --- | --- |
| `APP_ENV` | `local`, `test`, `uat`, or `production` | API, worker, database commands | No |
| `API_HOST` | Non-empty host without whitespace | API | No |
| `API_PORT` | Integer from 1 through 65535 | API | No |
| `AUTH_BASE_URL` | Canonical origin only; deployed UAT/production require HTTPS | API | No |
| `AUTH_SECRET` | At least 32 characters used to protect authentication state and encrypted provider-token fields | API | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth web-client identifier for the current environment | API | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web-client secret for the current environment | API | Yes |
| `SHUTDOWN_TIMEOUT_MS` | Integer milliseconds from 1 through 86400000 (24 hours) | API, worker | No |
| `DATABASE_URL` | `postgresql:` or `postgres:` URL with a host and database name | API, worker, database | Yes |
| `REDIS_URL` | `redis:` or `rediss:` URL with a host | API, worker | Yes when authenticated |
| `STORAGE_ENDPOINT` | HTTP or HTTPS S3-compatible API URL | API, worker | No |
| `STORAGE_REGION` | Non-empty signing region; use `us-east-1` for MinIO | API, worker | No |
| `STORAGE_BUCKET` | Valid lowercase S3 bucket name | API, worker | No |
| `STORAGE_ACCESS_KEY` | Non-empty application access-key identifier | API, worker | Yes |
| `STORAGE_SECRET_KEY` | Non-empty application secret access key | API, worker | Yes |
| `STORAGE_FORCE_PATH_STYLE` | `true` for MinIO; `false` for AWS S3 | API, worker | No |
| `RESEND_DELIVERY_MODE` | `disabled` for local/test, `preview` for the synthetic preview, or `live` for deployed UAT/production | API, worker | No |
| `RESEND_API_KEY` | Non-empty server-side Resend API key, `local-disabled` for local/test, or `preview-disabled` for the synthetic UAT-shaped preview | API, worker | Yes, except documented disabled placeholders |
| `RESEND_FROM` | Email address, optionally with a display name; exact environment values are fixed by the [email identity contract](#email-identities-and-ownership) | API, worker | No |
| `CONTACT_DELIVERY_TO` | One environment-approved Contact inbox; production uses `hello@pick-flick.app` and UAT uses an approved synthetic-test recipient | API, worker | Yes outside the production public address |
| `CONTACT_HASH_SECRET` | At least 32 characters used only for keyed source/content hashes | API, worker | Yes |

Authentication configuration is API-only: do not expose it to the worker, web client, browser
environment, logs, screenshots, or rendered Compose evidence. Configure a separate Google OAuth web
client for each deployed environment. Its authorized redirect URI must exactly equal
`AUTH_BASE_URL` followed by `/api/auth/callback/google`. Authorized JavaScript origins remain empty
for the server-side flow. The checked-in local values are synthetic and make deterministic checks
possible, but they cannot complete a live Google sign-in. Store deployed secrets only in the
environment's secret system and rotate them through a controlled provider and deployment change.

Better Auth 1.7.5 exposes the upstream atomic verification-consumption primitive added in
[better-auth#9568](https://github.com/better-auth/better-auth/pull/9568), but its social OAuth
database-state callback still performs separate lookup and deletion. PickFlick temporarily
backports the atomic call in `patches/better-auth@1.7.5.patch` so concurrent callbacks cannot both
reach provider code exchange. Keep `pnpm auth:check` coverage until a compatible stable release
contains the call-site fix; [issue #147](https://github.com/Shagon1k/PickFlick/issues/147) tracks
the bounded upgrade and patch removal.

MinIO and AWS S3 share the same signed S3 API contract. Running MinIO in the Dokploy project does
not remove the bucket or credential requirements. For UAT, use the public MinIO API origin as
`STORAGE_ENDPOINT`, set `STORAGE_FORCE_PATH_STYLE=true`, and keep the console private. This matches
the future presigned-URL shape. AWS S3 production configuration will use its regional endpoint and
set `STORAGE_FORCE_PATH_STYLE=false`.

The runtime validates the declared Resend delivery mode, environment, key kind, and Contact values
at startup but does not call Resend from readiness.
Readiness must not consume provider rate limits or require a full-access key when the application
only needs a domain-restricted sending key. Contact delivery provides the first plain-text adapter,
provider-idempotent bounded retries, durable failure state, and body-free logging. Phase 17 extends
that boundary with notification templates, preferences, bounce/suppression handling, and shared
BullMQ dispatch.

By default, processes load `.env` from the repository root without replacing variables already in
the process environment. Set `PICKFLICK_ENV_FILE` to an absolute path or a repository-relative path
to use another file. The named file must exist. Do not use the override to commit or expose secret
files.

## Continuous integration

The [CI workflow](../.github/workflows/ci.yml) runs for pull requests to `main` and pushes to
`main`. It installs the pinned Node.js and pnpm versions from a clean checkout, uses the lockfile
without updating it, and rejects tracked or untracked repository drift after the workspace build.

The workflow creates a unique Compose project for each run. It overrides `.env.example` with
synthetic `test` database and object-storage identifiers, starts PostgreSQL, Redis, and MinIO on the
isolated runner, and removes the containers and volumes even after a failed check. The workflow
uses the disabled local Resend placeholder and does not read UAT or production environment files,
data, or provider credentials.

CI runs static checks, UI quality checks, integration/runtime checks, and production image builds as
separate parallel jobs. The UI job runs `pnpm ui:test` against the production component preview and
uploads screenshots, visual diffs, axe output, traces, video, and the HTML report when it fails. See
the [UI quality guide](ui-quality.md) for its viewport and interaction coverage.

The integration job applies the committed migrations, loads deterministic fixtures, verifies
database constraints and dependency connectivity, runs the serialized Contact and authentication
probes, and runs `pnpm e2e:smoke`. The smoke command also proves that the built API mounts the raw
authentication handler at `/api/auth/*`. It starts the built web, API, and worker entrypoints;
checks web rendering, API liveness/readiness, and
worker readiness; then stops all three processes. CI also validates the deployment definitions and
runs the repository secret scan. The terminal `Delivery gate` fails unless the secret scan and all
four quality jobs pass. Any future delivery workflow must require that terminal gate.

## Runtime health, errors, and logs

The API exposes two unauthenticated probe endpoints:

| Endpoint | Success | Failure behavior |
| --- | --- | --- |
| `GET /health/live` | HTTP 200 with `{"service":"api","status":"alive"}` while the process can serve HTTP. | Process or HTTP-server failure prevents a response. The endpoint does not query dependencies. |
| `GET /health/ready` | HTTP 200 with each required dependency marked `up`. | HTTP 503 with each required dependency marked `up` or `down`; probe errors and configuration values are omitted. |

Readiness runs `SELECT 1` against PostgreSQL, sends `PING` to Redis, and authenticates an S3
`HeadBucket` request. Each probe enforces its two-second deadline through its database driver,
abort signal, or socket and cancels timed-out work. The worker runs the same checks before it
reports `service.ready`. If a dependency is unavailable, the worker logs only its stable dependency
name and exits unsuccessfully. Resend is not a readiness dependency. Contact delivery preserves
intent in PostgreSQL, applies provider idempotency and bounded retry in the worker, and records a
safe persistent-failure signal without making API readiness depend on the provider.

API responses include `x-request-id`. The API keeps a valid UUIDv4 supplied in `x-request-id` and
generates a new UUIDv4 for missing or invalid input. Boundary failures use this envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found.",
    "requestId": "123e4567-e89b-42d3-a456-426614174000"
  }
}
```

Stable baseline codes are `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`METHOD_NOT_ALLOWED`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMITED`,
`SERVICE_UNAVAILABLE`, `REQUEST_FAILED`, and `INTERNAL_ERROR`. Route-specific APIs may add codes
to the shared contract, but they must keep the safe message and request identifier.

API and worker logs are newline-delimited JSON. Each record has `service`, `environment`, `event`,
`level`, `time`, and the active request or job correlation fields. HTTP completion records contain
the route template, method, status, and duration. They omit request headers, bodies, and query
strings. Job logs omit handler payloads and raw errors. The logger redacts common credential keys as
a backstop; callers must still log allowlisted operational metadata instead of raw browser,
provider, job, or configuration objects.

Contact logs contain route, status, duration, request ID, Contact record ID, attempt count, and
fixed error codes only. They never contain message, name, email, raw source address, provider body,
or configuration values. A successful provider acceptance clears message, name, and email from
PostgreSQL; retryable and exhausted failures retain content so the owner can recover delivery.

## Local Compose variables

These variables configure `compose.local.yaml`. They are not application runtime variables unless
the runtime table also lists them.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Local PostgreSQL database, account, and loopback port |
| `REDIS_PORT` | Local Redis loopback port |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Local MinIO administrator used by the bucket initializer |
| `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | Local MinIO loopback ports |

Every published port binds to `127.0.0.1`. UAT and production must supply separate values through
their secret/configuration systems; they must not reuse this local file or its synthetic values.
