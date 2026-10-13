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

Session creation requires score and visibility snapshots. Call `snapshotSessionSettings` inside
its creation transaction; it locks the Club before reading. Roster and phase-decision services
hold Club → Session locks through their transaction. Session participants and invites use
composite foreign keys to stay within one Club; an identity-only trigger prevents moving a
participant between Sessions or Memberships. Issue #172 removes unused roster versioning.

`src/__tests__/session.int.spec.ts` proves concurrent blocking creation/transitions, Rating
coexistence, settings snapshots, participant identity/rollback, and member-only invite storage.
