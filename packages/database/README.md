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

Invariants that live in the SQL migrations (constraints, triggers and partial indexes) are tested
in `src/__tests__/constraints.int.spec.ts`, `src/__tests__/session.int.spec.ts` and the integration
specs of the backend module that owns each table. Each check names the constraint or trigger
message it expects.
