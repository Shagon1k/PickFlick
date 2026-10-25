# Develop locally

How to run PickFlick on your machine, work with the local database, and run the checks CI runs.
Variables and their rules are in the [environment reference](environment.md).

## Before you start

You need Docker and the Node version in `.node-version`. pnpm comes from Corepack:

```bash
corepack enable
```

## Start the app

1. Create your local environment file. Its values are synthetic.

    ```bash
    cp .env.example .env
    ```

2. Install dependencies.

    ```bash
    pnpm install --frozen-lockfile
    ```

3. Start PostgreSQL and MinIO and create the storage bucket.

    ```bash
    pnpm services:up
    ```

4. Apply the migrations and load the synthetic seed.

    ```bash
    pnpm db:migrate
    pnpm db:seed
    ```

5. Start the frontend, backend and deadline worker.

    ```bash
    pnpm dev
    ```

6. Open `http://127.0.0.1:3000`. Use `127.0.0.1`, not `localhost`: `AUTH_BASE_URL` and the local
   Google callback expect it.

`pnpm dev` builds the shared packages, then runs the frontend on port 3000, the backend on port 3001 and the deadline worker without a port. The backend rebuilds with `tsc` and restarts under `nodemon` when its code, the root `.env`,
or a shared package changes. The worker watches that compiled output. Apply migrations before starting
the worker; it applies overdue Nomination deadlines every five seconds.

## Enable the movie catalog

The example environment disables external catalog calls. In the ignored root `.env`, set
`CATALOG_ENABLED=true`. For the default `poiskkino-thetvdb` adapter, supply `POISKKINO_API_KEY`
and `THETVDB_READ_TOKEN`; the alternative `tmdb` adapter uses `TMDB_READ_TOKEN`.
Keep credentials on the backend; do not add them to `NEXT_PUBLIC_*`, source files or logs.
You can use approved UAT catalog credentials locally, but keep local database/storage destinations
and OAuth origin settings. Synthetic Google values in `.env.example` do not enable live sign-in;
configure a client whose callback matches local `AUTH_BASE_URL`.

Search and details populate the cache on demand. `CATALOG_REFRESH_HOURS` controls read freshness;
it does not start a scheduled refresh worker. Missing/failed posters have a placeholder and must
not be replaced with prototype film images. See the [environment reference](environment.md).

## Local services

| Service    | Host port                           | Check                 |
| ---------- | ----------------------------------- | --------------------- |
| PostgreSQL | `15432`                             | `pnpm services:check` |
| MinIO      | `19000` (S3 API), `19001` (console) | `pnpm services:check` |

The ports avoid the usual defaults and bind to `127.0.0.1` only. `pnpm services:down` stops the
containers and keeps their data.

## Work with the database

- `pnpm db:migrate` applies the reviewed migrations with `prisma migrate deploy`. Never use `db push`.
- `pnpm db:seed` loads stable synthetic data with `example.invalid` addresses and can run repeatedly.
- `pnpm db:reset` deletes all data and reapplies the migrations; run `pnpm db:seed` afterwards.

Seed and reset refuse to run unless `APP_ENV` is `local` with the database `pickflick_local` on a
loopback host, or `test` with `pickflick_test`. To change the schema, follow
[Add a feature end to end](adding-a-feature.md#2-change-the-database-if-the-feature-stores-data).

## Run the checks

| Goal                                        | Command                 |
| ------------------------------------------- | ----------------------- |
| Lint, knip, formatting, types, tests, build | `pnpm verify`           |
| Known high-severity vulnerabilities         | `pnpm security:audit`   |
| Database, auth, and Club integration specs  | `pnpm test:integration` |
| Core flows through the real web app and API | `pnpm test:journeys`    |
| Playwright PR smoke checks                  | `pnpm test:ui:smoke`    |
| Full Playwright behavior checks             | `pnpm test:ui:contract` |
| Playwright screenshot comparisons           | `pnpm test:ui:visual`   |
| Both Playwright selections                  | `pnpm test:ui`          |
| Smoke the built deadline worker             | `pnpm test:worker`      |
| Smoke the built frontend and backend        | `pnpm test:e2e`         |

`pnpm test:integration` needs the local services running. Run it and `pnpm test:journeys` against
an isolated test database so they never touch your local data:

1. Create the database once (use your `POSTGRES_USER`):

    ```bash
    docker compose --env-file .env -f compose.local.yaml exec postgres createdb -U pickflick pickflick_test
    ```

2. Copy `.env` to `.env.test`, then set `APP_ENV=test` and point `DATABASE_URL` at
   `pickflick_test`. Git ignores the file.
3. Apply the migrations and run the specs with `PICKFLICK_ENV_FILE=.env.test`, for example
   `PICKFLICK_ENV_FILE=.env.test pnpm db:migrate` and then `pnpm test:integration` the same way.

Browser journeys require `APP_ENV=test` and `pickflick_test`. Each journey connection clears the
database's auth rate-limit counters before making requests. Keep the configured single worker and
use a disposable database dedicated to the suite. Authentication rate limits remain enforced
throughout each journey.

The UI selections build the frontend and serve it against a mock backend, so they need no database.
The UI selections and the journeys each rebuild `apps/frontend/.next` for their own API address, so
rebuild before `pnpm start` after running them. Install Chromium once with
`pnpm exec playwright install chromium`. Run screenshot comparisons in the pinned Linux image;
see [UI quality checks](ui-quality.md).

The pre-commit hook scans staged files with gitleaks, formats them with Prettier, and fixes what
Stylelint and ESLint can. Commit messages follow Conventional Commits.

## Common problems

- **A port is in use.** Another project probably holds `15432` or `19000`. Stop it, or change
  `POSTGRES_PORT` or `MINIO_API_PORT` together with `DATABASE_URL` or `STORAGE_ENDPOINT` in `.env`.
- **The backend exits at startup.** The log names every invalid variable; compare `.env` with
  `.env.example`.
- **Sign-in fails locally.** Google needs a real OAuth client in `.env` whose redirect URI is
  `http://127.0.0.1:3000/api/auth/callback/google`. Apple stays off (`APPLE_SIGN_IN_ENABLED=false`).
- **The catalog cannot search.** Set `CATALOG_ENABLED=true` and provide credentials for the selected
  `CATALOG_PROVIDER` in `.env`. PoiskKino + TheTVDB needs both `POISKKINO_API_KEY` and
  `THETVDB_READ_TOKEN`. TheTVDB expects the bearer token returned as `data.token` by its
  `/v4/login` API; an API key must be exchanged there first, rather than copied into the token field.
- **Contact succeeds but no email arrives locally.** Local email delivery is disabled by default;
  the backend logs that delivery was skipped and stores no message body. Verify real delivery only
  with an explicitly configured live sender and approved recipient.
- **Seed or reset refuses to run.** Check `APP_ENV` and the database name in `DATABASE_URL`.
- **`/ui-preview` or `/shell-preview` answers 404.** They are hidden only when
  `APP_ENV=production`.
- **You need another environment file.** Set `PICKFLICK_ENV_FILE` to its path; processes never
  override variables already set in the shell.
