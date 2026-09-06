# Environment and local data services

This reference defines the configuration implemented for the API, worker, database commands, and
local data-service stack. Later provider and deployment issues extend this inventory when their
consumers exist.

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
