# Phase 13 — Watching, Rating and completion

This active phase completes the Session lifecycle. [Roadmap Phase 13](../ROADMAP.md#phase-13--watching-rating--completion--in-progress)
owns scope and acceptance; [Project 3](https://github.com/users/Shagon1k/projects/3) owns live status.

## Dependencies and scope

Phase 12 is accepted under [#48](https://github.com/Shagon1k/PickFlick/issues/48). Delivery builds on
the existing Club → Session locks, partial blocking-Session index, Session roster, saved Selection
outcome and authenticated progress poll.

- [#49](https://github.com/Shagon1k/PickFlick/issues/49): Watching context and manual Rating opening.
- [#50](https://github.com/Shagon1k/PickFlick/issues/50): Session Ratings and completion.
- [#51](https://github.com/Shagon1k/PickFlick/issues/51): Completed history and non-blocking Rating views.

## Watching delivery

Reuse the existing film header/media, context, accepted roster and edit/invite/join/leave/Kick/cancel
controls. Attendance here is the joined roster; browser presence never proves a physical screening.
Add one operator-confirmed command to open Rating, shared by the Session Settings menu and Manage
Club. Keep Rating submission, completion, past Sessions, Personal Ratings and notifications outside
this delivery.

Migration 26 adds one audit action. The API updates phase, versions, audit and progress in one
transaction; the existing index releases the Club slot at commit. Apply the migration before the
updated API. Archived, adminless and over-limit Clubs retain the existing management restrictions.

## Verification

- Database/API: no read or roster-triggered advancement; operator authorization; concurrent retries;
  stale versions; atomic rollback and blocking-slot release; preserved Movie and participants.
- Browser: real Admin/Moderator/Member journey, Manage Club wiring and cross-client polling.
- Responsive UI: 390, 768, 1024 and 1440px, keyboard confirmation/cancel/focus return, axe and
  overflow checks, offline/error/stale feedback.
- Run the repository static gate and relevant integration/UI regression suites.
- Before acceptance, retain the exact head SHA, hosted Watching preview URL and owner visual
  acknowledgment on #49. Automated and local evidence cannot satisfy that review gate.

Local evidence on 2026-10-23:

| Check                                                  | Result                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| Migration deployment to isolated `pickflick_test`      | All 26 migrations applied                                        |
| `pnpm test:integration`                                | 23 files, 206 tests passed                                       |
| `pnpm test:unit`                                       | 46 files, 339 tests passed                                       |
| Lint, formatting, type checking and Knip               | Passed                                                           |
| Production dependency audit                            | Passed the high/critical gate; 3 moderate advisories remain      |
| Watching UI contract and Selection menu regression     | 9 passed; four widths, axe, keyboard/pointer, focus and failures |
| `pnpm test:ui:smoke`                                   | 42 passed on the final run                                       |
| `pnpm test:journeys`                                   | 3 passed, including real Admin/Moderator/Member Watching flow    |
| Shared package, backend and production frontend builds | Passed through the UI/journey commands                           |

The first smoke run exposed a click racing the shared menu's focus/scroll animation. The
Selection check now waits for initial focus and finite animations before clicking, and for the
dialog to finish closing before reopening. The focused rerun passed without changing shared UI
behavior. The final full smoke and real-role journeys passed.

The subsequent [PR UI smoke run](https://github.com/Shagon1k/PickFlick/actions/runs/39981245774/job/120508788115)
failed on transient contrast in the Open Rating dialog during its 200 ms fade. The Watching test
now waits for dialog opacity `1` before running axe and capturing the confirmation, matching the
existing Selection confirmation check.

Repair verification: all 12 focused Watching runs passed (three runs at each width, retries
disabled), as did focused lint and formatting. The full CI-mode smoke run passed all four Watching
checks and reported 41 passes plus one flaky Session roster `Kick` click timeout, which passed on
retry. The smoke command therefore exited with failure; that separate test remains unchanged.
`pnpm verify` passed, including the dependency audit gate, lint, Knip, formatting, type checking,
all 339 unit tests and workspace builds.

The exact-SHA hosted preview and owner visual acknowledgment remain required on #49. The repository has no hosted-preview workflow; no preview URL has been supplied for this run.
Phase-level completion evidence belongs in Roadmap only when the entire phase is accepted.
