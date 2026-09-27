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

5. Start the frontend and backend.

    ```bash
    pnpm dev
    ```

6. Open `http://127.0.0.1:3000`. Use `127.0.0.1`, not `localhost`: `AUTH_BASE_URL` and the local
   Google callback expect it.

`pnpm dev` builds the shared packages, then runs the frontend on port 3000 and the backend on port 3001. The backend rebuilds with `tsc` and restarts under `nodemon` when its code, the root `.env`,
or a shared package changes.

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

| Goal                                          | Command                         |
| --------------------------------------------- | ------------------------------- |
| Lint, knip, formatting, types, tests, build   | `pnpm verify`                   |
| Known high-severity vulnerabilities           | `pnpm audit --audit-level high` |
| Database, auth, and Club integration specs    | `pnpm test:integration`         |
| Playwright accessibility and screenshot suite | `pnpm test:ui`                  |
| Smoke the built frontend and backend          | `pnpm test:e2e`                 |

`pnpm test:integration` needs the local services running. `pnpm test:ui` builds the frontend and
serves it against a mock backend, so it needs no database; install its browser once with
`pnpm exec playwright install chromium`. See [UI quality checks](ui-quality.md) for baselines.

The pre-commit hook scans staged files with gitleaks, formats them with Prettier, and fixes what
Stylelint and ESLint can. Commit messages follow Conventional Commits.

## Common problems

- **A port is in use.** Another project probably holds `15432` or `19000`. Stop it, or change
  `POSTGRES_PORT` or `MINIO_API_PORT` together with `DATABASE_URL` or `STORAGE_ENDPOINT` in `.env`.
- **The backend exits at startup.** The log names every invalid variable; compare `.env` with
  `.env.example`.
- **Sign-in fails locally.** Google needs a real OAuth client in `.env` whose redirect URI is
  `http://127.0.0.1:3000/api/auth/callback/google`. Apple stays off (`APPLE_SIGN_IN_ENABLED=false`).
- **Seed or reset refuses to run.** Check `APP_ENV` and the database name in `DATABASE_URL`.
- **`/ui-preview` or `/shell-preview` answers 404.** They are hidden only when
  `APP_ENV=production`.
- **You need another environment file.** Set `PICKFLICK_ENV_FILE` to its path; processes never
  override variables already set in the shell.
