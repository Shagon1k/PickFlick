# Phase 14 — Past Sessions

[Roadmap scope and acceptance](../ROADMAP.md#phase-14--past-sessions--shared-history--in-progress)
remain canonical. Project 3 owns the live status of [#52](https://github.com/Shagon1k/PickFlick/issues/52)
and [#53](https://github.com/Shagon1k/PickFlick/issues/53).

Run `r_29040fec8b495f603abc` implements #52 on the managed branch
`PF-52_14-1-record-minimal-past-sessions`. It reuses Club authorization/locking, settings snapshots,
historical Membership references, Movie picking, Completed detail and Hub history. Optional nomination
and score-matrix reconstruction belongs to #53.

Past Sessions enter Completed directly. Only supplied attendees and 1–10 ratings are stored.
The PAST Session type records imported provenance; imported ratings have no submission timestamp.
Migration 28 permits those null timestamps while retaining immutable responses and the live Rating
phase guard. Deploy the migration before the API. No existing rows are backfilled.

Former Memberships may be selected explicitly. References preserve attribution through later
departure or anonymization. Repeat screenings reuse one canonical Movie in distinct Sessions.
The picker lists each person once using their latest Membership. Duplicate attendee entries,
including two Memberships for a rejoined person, and cross-Club Membership IDs are rejected. Empty attendee selections
mean no attendance evidence was supplied. Live Session date validation remains unchanged.

Verification covers partial-data API/database integration, provenance constraints, authorization,
real-API browser creation, responsive validation, keyboard/touch, axe and retained input on failures.
Local verification on 2026-10-23 uses Node 24.15.0 and pnpm 11.25.0 with an isolated,
seeded `pickflick_test` database.

| Check                   | Result                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm db:migrate`       | All 28 migrations applied                                              |
| `pnpm test:integration` | 25 files, 229 tests passed, including 8 past-Session checks            |
| `pnpm test:journeys`    | All 11 passed, including 5 past-Session checks and existing live flows |

`pnpm test:ui:smoke` passed all 54 checks, including existing Session creation, Movie picking,
Completed history and Watching/Rating regressions.

`pnpm lint`, `pnpm knip`, `pnpm format:check` and `pnpm typecheck` passed.
`pnpm test:unit` passed all 350 tests across 48 files. `pnpm build` passed every workspace build.
The audit gate initially blocked `pnpm verify`; CI repair attempt 2 below clears it.

The past-Session journeys check 390/768/1024/1440px layouts, axe, keyboard/touch ratings,
clear-to-unknown behavior, offline retention, request failure recovery, Member denial and the
resulting Completed record. Local form and result captures are in
`test-results/past-{form,completed}-{viewport}.png`; phone and desktop captures were inspected.
Visual baselines were not updated.

The repository has no hosted-preview workflow. #52 requires its exact final SHA on a hosted preview
and owner visual acknowledgment before acceptance. Local captures and a Draft PR do not satisfy it.

The new browser checks exposed two shared UI regressions: setup cards could grow wider than a
phone when a rating rail appeared, and keyboard Movie selection retained an ARIA reference to a
removed result. The shared card now permits shrinking, and the picker clears its active option.

CI repair attempt 1 on 2026-10-24 addresses the failed dependency audit in
[run 40028517461](https://github.com/Shagon1k/PickFlick/actions/runs/40028517461).
The authorized source was `dc3f290fa162fc4b1f7585079d1068ce354e94da`. Only Zod changes:
the catalog and lockfile use the published 4.6.6 patch for
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), within existing consumer
ranges. The frozen install and all 120 focused contract, environment and validation-pipe tests pass.

After attempt 1, the audit no longer reported Zod. `pnpm verify` still stopped at its production audit gate:
new high-severity findings affect `body-parser` and `multer`. Those findings were absent from the
failed CI evidence and remained outside that bounded repair. Remaining checks ran explicitly so their
results remained available.

Repair verification also passes `pnpm lint`, `pnpm knip`, `pnpm format:check`, `pnpm typecheck`,
all 350 unit tests and `pnpm build`. Integration, browser and image checks are not rerun locally
for this dependency patch; they passed in the source-SHA CI run. Fresh CI is not awaited.

CI repair attempt 2 on 2026-10-24 addresses the dependency audit behind the failed Delivery gate in
[run 40075170330](https://github.com/Shagon1k/PickFlick/actions/runs/40075170330), from authorized
source `526ce0dc525730d202c22ff001b416c7a225e734`. The lockfile selects the published
`body-parser@2.4.0` fix for [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)
within Express's range, plus its required `qs@6.16.1`. A Nest-adapter-scoped override selects
`multer@2.5.0` for [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m).
No application code or audit policy changes.

The frozen install and production audit pass; only 2 low and 5 moderate findings remain. Temporary
runtime checks pass for Express JSON, form and raw parsing, invalid JSON, gzip/deflate trailing bytes,
and the upstream Multer asynchronous file-filter teardown regression. All 9 focused backend tests
pass. Integration, browser and image checks are not rerun locally for this repair; those jobs passed
in the source-SHA CI run. Fresh CI is not awaited or retried.

`PICKFLICK_ENV_FILE=.env.example pnpm verify` passes the production audit, lint, Knip, formatting,
type checking, all 350 unit tests and every workspace build on Node 24.15.0 / pnpm 11.25.0.
