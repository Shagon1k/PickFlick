# Phase 11 — Selection

Build immutable scored ballots, deterministic winner resolution, and policy-filtered results.
The [Roadmap](../ROADMAP.md#phase-11--selection--winner-resolution--in-progress) owns phase
scope and acceptance. [Project 3](https://github.com/users/Shagon1k/projects/3) owns live status.

## Delivery boundaries

- [#45](https://github.com/Shagon1k/PickFlick/issues/45): complete immutable ballots, generated
  controls, submission progress and locked state.
- [#46](https://github.com/Shagon1k/PickFlick/issues/46): automatic and manual winner resolution.
- [#47](https://github.com/Shagon1k/PickFlick/issues/47): permitted result projections and updates.

## Ballot implementation

Reuse Club → Session locks, scale/settings snapshots, cache-only Movie summaries, progress
polling and the shared ScoreControl. A PostgreSQL trigger freezes eligible nominations on entry to Selection;
later departures change the accepted-participant denominator without changing a ballot's films.
Each submission inserts one ballot and all its scores in one transaction. A duplicate submission
returns `ALREADY_SUBMITTED`; no update route exists. Only the caller's scores and aggregate
submission counts are returned. New participants accepted during Selection score the same films.

Migration 24 adds ballot/score tables, uniqueness and same-Session foreign keys, and the nomination
eligibility marker. Existing Selection Sessions inherit currently accepted nominations. The phase
trigger also covers older API/worker writers during deployment, without a runtime fallback. No new
dependency, environment variable, notification delivery, winner calculation or result breakdown is
included in #45. Selection remains open after the final ballot until #46 adds closure.

## Verification

- Every supported scale, completeness, duplicate IDs, foreign nominations and invalid scores.
- Real database uniqueness, composite foreign keys and concurrent submission.
- Current Membership, accepted participation, archived Club and closed phase enforcement.
- Keyboard, touch, incomplete submission, errors/offline, locked state and responsive accessibility.
- Repository quality gate and real API browser journey.
- Hosted preview at the exact pushed head SHA and owner visual acknowledgment remain required
  before #45 can be completed. Local captures and a Draft PR do not satisfy that criterion.

## Local evidence — 2026-10-14

Run `r_fed28d41ed83780d4bc0` uses Node 24.15.0 and pnpm 11.25.0. Migration 24 applied
successfully to an isolated loopback `pickflick_test` database with the documented synthetic seed.

- Static gate commands pass: `pnpm security:audit`, `pnpm lint`, `pnpm knip`,
  `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit` (306 tests across 44 files), and
  `pnpm build`.
- `pnpm test:integration`: 161 tests passed across 18 files. The nine Selection tests cover
  all 19 supported ranges, complete/invalid ballots, concurrent submission, PostgreSQL constraints,
  visibility and departure history.
- `pnpm test:journeys`: both journeys passed. The Selection journey submits two authenticated
  nominations through the real API, scores both ballots in the browser, reloads locked scores and
  observes shared progress.
- The PR smoke selection plus all Selection checks passed 45 tests (`playwright test --config
playwright.ui.config.ts --grep '@smoke|selection.spec' --grep-invert @visual`). The nine Selection
  tests include keyboard, touch, offline
  and recoverable errors, read-only/empty states, axe and overflow at all four canonical widths.
  Captures are retained under `test-results/selection-review/` for local inspection.

Hosted exact-head preview, owner visual acknowledgment and new-head CI remain unverified.
#46 and #47 retain winner closure and result projection work. This evidence does not complete
Phase 11 or mark #45 accepted.
