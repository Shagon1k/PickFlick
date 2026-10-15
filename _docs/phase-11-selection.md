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
included in #45. Winner closure is implemented separately in #46.

Before touching Nomination, migration 24 takes an `EXCLUSIVE` table lock on Session so in-flight
`SELECT FOR UPDATE` writers can finish their nomination and Session updates before the DDL runs.

## Verification

- Every supported scale, completeness, duplicate IDs, foreign nominations and invalid scores.
- Real database uniqueness, composite foreign keys and concurrent submission.
- Migration concurrency with an in-flight Nomination writer, including its phase/progress update
  and the eligible nomination backfill.
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

## Review fix round 1 — 2026-10-15

The migration concurrency regression reproduces PostgreSQL deadlock `40P01` with the original
`SHARE ROW EXCLUSIVE` lock and passes with `EXCLUSIVE`. The writer completes its phase/progress
update, and the migration backfills its committed nomination. The corrected migration applies
successfully to a fresh loopback test database; all 162 integration tests across 19 files pass.

Selection now focuses its own heading ref after successful submission, following Nomination's
pattern. Error and offline paths retain their scores. `pnpm verify` passes, including all 306 unit
tests and the production build.

The PR smoke selection plus all Selection checks pass 45 tests (`playwright test --config
playwright.ui.config.ts --grep '@smoke|selection.spec' --grep-invert @visual`), including successful
submission focus, score retention on recoverable errors/offline, touch, keyboard and accessibility.
Hosted exact-head preview, owner visual acknowledgment and new-head CI remain unverified.

## Winner resolution — #46

Run `r_72a1c96e16284ba4d904` reuses immutable ballots, the eligible nomination marker,
Club → Session locks and the progress outbox. Automatic positive N/N completion runs after
submission and roster/lifecycle changes. Operator closure accepts `CLOSE` and `phaseVersion`;
retries reuse the saved result without advancing or publishing again. No result UI or projection
is added here; #47 owns those surfaces.

All received ballots count, including ballots retained after departure. With no ballots, totals
are zero and the nomination/provider/nomination-ID tie-breaks select one nomination. Positive
scores count as support. Provider mappings use a stable source/ID order, numeric comparison for
numeric IDs and missing mappings last; the Roadmap records the exact rule.

Migration 25 adds the Session result snapshot and manual audit action. The snapshot freezes the
scale, accepted roster, nominations, provider mappings, ballots, ranking metrics, winning
nomination, decisive tie-break and closure provenance. PostgreSQL rejects changes to a saved
snapshot or selected Movie. Existing history is not backfilled; an existing open Selection is
evaluated on its next workflow mutation. No new dependency, environment variable or service is
required. Apply migration 25 before the API.

Verification covers each tie-break, no ballots, repeated Movies, stored 1-based scales, received
ballots after departure, zero accepted participants, Session/Club departure, removal, archive and
reactivation, concurrent/manual/automatic closure, retries, outbox rollback, authorization and
snapshot immutability. The real API browser journey checks the final ballot transitions both
participants to Watching with the selected Movie.

### Local evidence — 2026-10-15

Node 24.15.0 and pnpm 11.25.0; all 25 migrations apply to a fresh isolated loopback
`pickflick_test` database with the synthetic seed.

- `pnpm verify` passes, including 320 unit tests across 45 files and the production build.
  The 14 resolver tests cover all tie-break steps and the documented edge rules.
- `pnpm test:integration`: 179 tests pass across 20 files. Seventeen closure tests cover
  automatic/manual/concurrent completion, retries, roster changes, archived Clubs, outbox rollback,
  authorization, immutable snapshots and private API responses.
- `pnpm test:journeys`: both real-API browser journeys pass, including the final-ballot transition
  to Watching and the selected Movie link on both clients.
- `pnpm test:ui:smoke`: all 37 PR checks pass, including Selection keyboard submission,
  Session roster/workflows, accessibility, security headers and horizontal overflow.

The production dependency audit passes the high/critical gate and reports one moderate advisory.
The isolated PostgreSQL test container and its data were removed. No deployment was performed;
remote CI and owner review remain unverified. Phase 11 completion and #47 UI review remain separate.

## Policy-filtered results — #47

Run `r_e7c12f46281d389f677a` uses the existing saved winner snapshot, Session settings,
Club entitlement adapter, progress outbox and shared confirmation dialog. The result DTO gives
current members the winner and closure information; Admins/Moderators receive aggregate rankings,
while ordinary members need Pro plus the Session visibility snapshot. Nominator visibility is
independent. Rankings and tie-break metrics remain frozen; display metadata stays current.
No raw ballots, roster IDs, provider mappings or internal snapshot are returned.

The later #172 owner decision and current Architecture retain authenticated progress polling.
The issue's earlier SSE wording is superseded; this run does not restore per-connection database
polling or introduce a new event transport. Existing progress and closure events remain atomic
with the ballot and winner; clients re-read the permitted projection on version change/reconnect.

The UI adds a winner card, allowed rankings, zero-ballot and hidden-result feedback, and operator
early closure with typed `CLOSE`, focus handling and retained input on offline/API failures.
Watching/Rating workflows, notification delivery and Paddle transport remain outside this task.

Verification covers Free/Pro/visibility/role authorization, current access after departure,
snapshot stability on retry/source changes, multi-client reconnect and browser result/confirmation
states at 390, 768, 1024 and 1440 pixels. All 25 existing migrations applied to an isolated
loopback test database.
Hosted exact-head preview and owner visual acknowledgment remain required; local captures and
a Draft PR do not complete #47 or Phase 11.

### Local evidence — 2026-10-15

Node 24.15.0 and pnpm 11.25.0; no dependency or migration was added.

- `pnpm lint`, `pnpm knip`, `pnpm format:check`, `pnpm typecheck` and `pnpm security:audit`
  pass. The production audit reports one moderate advisory and no high/critical advisories.
- `pnpm test:unit`: all 320 tests across 45 files pass.
- `pnpm test:integration`: all 186 tests across 21 files pass after applying the documented
  synthetic seed. Seven result-projection tests cover the authorization matrix, hidden names,
  frozen metrics, retries, tier/role changes, Session settings snapshots and access revocation.
- The PR smoke selection plus both Selection specs pass all 59 checks (`playwright test --config
playwright.ui.config.ts --grep '@smoke|selection.*spec' --grep-invert @visual`). The fourteen
  new result/confirmation checks cover keyboard and focus return, retained confirmation after
  offline/API failures, hidden/visible results, axe and overflow at all four canonical widths.
  Captures under `test-results/ui-artifacts/selection-outcome-*` were inspected at mobile and
  desktop sizes. Existing visual baselines were not changed.
- `pnpm test:journeys`: both real-API browser journeys pass. Selection verifies live submission
  progress in a second client, winner recovery after offline/reconnect, Free-member privacy,
  Admin aggregate visibility, reload and an idempotent closure retry. The journey setup builds
  every shared package, the backend and the production frontend.

These commands exercise every static-gate step individually; `pnpm verify` was not run as a
single wrapper command. Remote CI and hosted preview/owner review remain unverified.
