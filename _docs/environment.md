# Environment and runtime operations

This reference defines the configuration implemented for the API, worker, database commands, local
data-service stack, production images, and proportional application deployment topology. Later
provider and provisioning issues extend this inventory when their consumers exist.

## Deployment images and Compose

`Dockerfile` builds four targets from the same locked workspace and full source revision:

| Target | Runtime | Default command |
| --- | --- | --- |
| `web` | Next.js standalone server on port 3000 | `node apps/web/server.js` |
| `api` | Compiled NestJS API on port 3001 | `node dist/main.js` |
| `worker` | Compiled worker process | `node dist/main.js` |
| `release` | One-shot database release gate | `node scripts/run-release.mjs` |

Run `pnpm images:build` from a clean Git checkout. The command passes the full Git revision into
each build, sets the image revision label, and tags each local image with the first 12 revision
characters. When Git metadata is available, a configured `SOURCE_REVISION` must match `HEAD` and
does not bypass the clean-worktree check. The command trusts the full hexadecimal override only
when the build context has no Git metadata. The Dockerfile pins both Node base images by
multi-platform digest, pins the Dockerfile frontend by digest, and installs from the committed
pnpm lockfile. `.dockerignore` excludes every local build artifact and platform file covered by
`.gitignore`, so ignored files do not enter the Docker context.

The release image runs committed Prisma migrations before the production-safe required-seed step.
The required-seed step currently verifies database connectivity because no shared reference rows
exist. Any failed step exits nonzero. `compose.deploy.yaml` keeps the one-shot release service in
the `release` profile and web, API, and worker in the `application` profile. Each service builds
its matching Dockerfile target from the selected full revision. Run the guarded deployment command
after configuring the environment-specific values:

```bash
pnpm deploy:compose
```

The command builds and runs the release profile first. It builds and converges the application
profile only after the release container exits successfully. A failed migration or seed stops the
command before Compose recreates the running application containers. Do not run the `application`
profile directly.

Use `compose.deploy.yaml` for source-built UAT deployments. `pnpm deploy:compose` rejects every
other `APP_ENV`; production must wait for the UAT-proven digest-promotion workflow from issue #115.
Keep UAT and production in separate Compose and Dokploy projects. Configure Dokploy to clone the
selected full Git revision and use Docker Compose mode, not Docker Stack mode. Supply all runtime
values from the environment-specific Dokploy project and render the exact configuration before
deployment:

```bash
pnpm compose:check
docker compose -f compose.deploy.yaml --profile release --profile application config --format json
```

`pnpm compose:check` renders synthetic UAT and production configurations and verifies their static
contract. It checks the exact application service set, runtime-required environment inputs,
source-revision build/runtime reporting, staged release/application profiles, the release image
target plus command/entrypoint inheritance, intended API/web health checks, web's API-health
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
| `SOURCE_REVISION` | Selected full hexadecimal Git revision passed to every build and runtime service |

The remote Compose file owns only `release`, `api`, `worker`, and `web`; it defines no data service
or persistent volume. Every service joins the pre-created external application network with an
environment-specific alias. Web and API use `expose`; no service publishes a host port. Connect the
environment's managed PostgreSQL and Redis resources to the same application network, supply their
internal connection URLs, and keep their external ports disabled in Dokploy. UAT and production
must use different Dokploy projects, application networks, service aliases, database/Redis
credentials, S3 buckets and credentials, and SMTP/provider identities. A separate production
deployment server is deferred until production provisioning, or until measured contention or a
host-isolation requirement justifies one earlier.

API and worker stop accepting new work on `SIGINT` or `SIGTERM`. They wait up to
`SHUTDOWN_TIMEOUT_MS` for shutdown work to finish. Deployment Compose fixes this timeout at 10
seconds under a 15-second stop grace. Add a configurable, queue-aware drain and coordinated grace
only when a real consumer supplies measured job-duration and retry requirements.

In UAT and production, `SOURCE_REVISION` is required and must be a full 40- or 64-character
hexadecimal revision. The API returns it from `/health/live`; every Dockerfile target also records
it in the `org.opencontainers.image.revision` label.

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
pnpm dev
```

`pnpm services:up` waits for PostgreSQL, Redis, MinIO, and Mailpit, then creates the configured
MinIO bucket if it does not exist. `pnpm services:check` checks each service from the host and uses
the runtime S3 credentials to verify access to the configured bucket.
`pnpm db:check` verifies the migration history, migration upgrade compatibility, deterministic
fixtures, and PostgreSQL constraints.

Stop the containers with `pnpm services:down`. That command retains the named volumes. Delete the
volumes only when you intentionally want to discard all local service data.

## Run migrations and seeds

`pnpm migrate` uses `prisma migrate deploy`; it never uses `db push`. The two initial migrations
create the `User`, `Club`, `Membership`, and `Session` foundation, then add reviewed PostgreSQL
constraints. The second migration is backward compatible with the first application schema because
it changes no columns or types.

`pnpm seed` is idempotent and uses stable identifiers plus `example.invalid` email addresses. It
refuses every environment except `local` and `test`. A local seed also requires a loopback database
host, no driver-level host override, and the database name `pickflick_local`; a test seed requires
`pickflick_test`.

`pnpm db:reset` is destructive. It applies the same positive environment, host, and database-name
guards before invoking `prisma migrate reset`. Never use it against shared, UAT, or production data.

## Runtime variables

The API and worker validate their runtime variables before starting. The worker does not require
the API-only bind settings. Validation errors name invalid variables but never echo their values.

| Variable | Type and allowed values | Consumer | Sensitive |
| --- | --- | --- | --- |
| `APP_ENV` | `local`, `test`, `uat`, or `production` | API, worker, database commands | No |
| `API_HOST` | Non-empty host without whitespace | API | No |
| `API_PORT` | Integer from 1 through 65535 | API | No |
| `SHUTDOWN_TIMEOUT_MS` | Integer milliseconds from 1 through 86400000 (24 hours) | API, worker | No |
| `DATABASE_URL` | `postgresql:` or `postgres:` URL with a host and database name | API, worker, database | Yes |
| `REDIS_URL` | `redis:` or `rediss:` URL with a host | API, worker | Yes when authenticated |
| `S3_ENDPOINT` | HTTP or HTTPS URL | API, worker | No |
| `S3_REGION` | Non-empty region | API, worker | No |
| `S3_BUCKET` | Valid lowercase S3 bucket name | API, worker | No |
| `S3_ACCESS_KEY_ID` | Non-empty access-key identifier | API, worker | Yes |
| `S3_SECRET_ACCESS_KEY` | Non-empty secret access key | API, worker | Yes |
| `S3_FORCE_PATH_STYLE` | `true` or `false` | API, worker | No |
| `SMTP_HOST` | Non-empty host | API, worker | No |
| `SMTP_PORT` | Integer from 1 through 65535 | API, worker | No |
| `SMTP_SECURE` | `true` or `false` | API, worker | No |
| `MAIL_FROM` | Email address, optionally with a display name | API, worker | No |

By default, processes load `.env` from the repository root without replacing variables already in
the process environment. Set `PICKFLICK_ENV_FILE` to an absolute path or a repository-relative path
to use another file. The named file must exist. Do not use the override to commit or expose secret
files.

## Continuous integration

The [CI workflow](../.github/workflows/ci.yml) runs for pull requests to `main` and pushes to
`main`. It installs the pinned Node.js and pnpm versions from a clean checkout, uses the lockfile
without updating it, and rejects tracked or untracked repository drift after generation and build
steps.

The workflow creates a unique Compose project for each run. It overrides `.env.example` with
synthetic `test` database and object-storage identifiers, starts PostgreSQL, Redis, MinIO, and
Mailpit on the isolated runner, and removes the containers and volumes even after a failed check.
The workflow does not read UAT or production environment files, data, or provider credentials.

After static checks and unit tests, CI applies the committed migrations, loads deterministic
fixtures, verifies database constraints and dependency connectivity, and runs `pnpm e2e:smoke`.
The smoke command starts the built web, API, and worker entrypoints; checks web rendering, API
liveness/readiness, and worker readiness; then stops all three processes. CI also validates the
deployment definitions, builds each production image target from the checked-out revision, and
runs the repository secret scan. The terminal `Delivery gate` fails unless both the secret scan and
the complete quality job pass. Any future delivery workflow must require that terminal gate.

## Runtime health, errors, and logs

The API exposes two unauthenticated probe endpoints:

| Endpoint | Success | Failure behavior |
| --- | --- | --- |
| `GET /health/live` | HTTP 200 with `{"service":"api","status":"alive"}` while the process can serve HTTP. | Process or HTTP-server failure prevents a response. The endpoint does not query dependencies. |
| `GET /health/ready` | HTTP 200 with each required dependency marked `up`. | HTTP 503 with each required dependency marked `up` or `down`; probe errors and configuration values are omitted. |

Readiness runs `SELECT 1` against PostgreSQL, sends `PING` to Redis, authenticates an S3
`HeadBucket` request, and waits for the complete SMTP greeting. Each probe enforces its two-second
deadline through its database driver, abort signal, or socket and cancels timed-out work. The worker
runs the same checks before it reports `service.ready`. If a dependency is unavailable, the worker
logs only its stable dependency name and exits unsuccessfully.

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

## Local Compose variables

These variables configure `compose.local.yaml`. They are not application runtime variables unless
the runtime table also lists them.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Local PostgreSQL database, account, and loopback port |
| `REDIS_PORT` | Local Redis loopback port |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Local MinIO administrator used by the bucket initializer |
| `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | Local MinIO loopback ports |
| `MAILPIT_SMTP_PORT`, `MAILPIT_HTTP_PORT` | Local Mailpit SMTP and web-interface loopback ports |

Every published port binds to `127.0.0.1`. UAT and production must supply separate values through
their secret/configuration systems; they must not reuse this local file or its synthetic values.
