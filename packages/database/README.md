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
summary title/year on `Movie`, and provider/locale keyed detail and search projections. The source migration preserves UUIDs and existing mappings, invalidates legacy JSON
caches and fails on contradictory legacy IMDb mappings. Session/Library references must use UUIDs.

Session creation requires score and visibility snapshots. Call `snapshotSessionSettings` inside
its creation transaction; it locks the Club before reading. A database trigger keeps a Session
participant bound to its Session, Membership, and Club. Session participants and
invites use composite foreign keys to stay within one Club. Current API workflows enforce authorization, participation and invite responses; these internal
persistence helpers do not replace those checks.

`src/__tests__/session.int.spec.ts` proves concurrent blocking creation/transitions, Rating
coexistence, settings snapshots, roster serialization/rollback, and member-only invite storage.

Migration 25 adds Session `selectionResult` JSON and `SESSION_SELECTION_CLOSED`. Closure stores
the inputs, ranking and explanation with the selected Movie in one transaction. A PostgreSQL
trigger freezes the saved snapshot and selected Movie; existing history is not backfilled.
