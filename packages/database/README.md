# @pickflick/database

Prisma schema, reviewed migrations, the generated client, fixtures, and guarded CLIs.

- `prisma/schema.prisma` and `prisma/migrations/` — change the schema, write or review the SQL
  migration, then run `pnpm db:migrate`. Never use `db push`.
- `src/client.ts` — `createDatabaseAdapter` and the generated `PrismaClient`.
- `src/fixtures.ts` — deterministic synthetic fixtures used by the seed and tests.
- `src/cli/` — `seed`, `seed-release` (the release job's required seed step), `reset`,
  `run-prisma`, and `check-services`. Seed and reset refuse anything but a positively identified
  local or test database.
- `src/__tests__/constraints.int.spec.ts` — database constraint checks (`pnpm test:integration`).

The catalog uses `Movie.id` UUID as identity, `MovieExternalId` for unique source correspondences,
`MovieSourceCache` for independent source clocks, and configuration/locale keyed detail/search
projections. The source migration preserves UUIDs and existing mappings, invalidates legacy JSON
caches and fails on contradictory legacy IMDb mappings. Session/Library references must use UUIDs.
