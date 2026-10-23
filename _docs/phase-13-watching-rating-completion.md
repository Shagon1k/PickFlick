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

## Session Rating delivery (#50)

Run `r_d4d87ace347a0c6ca4bb` implements one immutable historical response per participant,
fixed 1–10 validation, optional comments, policy-filtered results and positive N/N or operator
partial completion. It reuses Club → Session locking, roster completion hooks, lifecycle
reactivation, transactional progress events and authenticated polling. No PersonalMovieRating,
full Completed composition, Hub history or notification delivery is added.

Migration 27 adds SessionRating storage and the manual closure audit action. Deploy it before the
updated API. Existing Session history is unchanged. Identical retries return success; conflicting
resubmissions preserve the first response. Other responses and averages are disclosed only after
completion according to the Session's rating visibility snapshot and the viewer's current role.

Local verification on 2026-10-23:

| Check                                           | Result                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Isolated `pickflick_test` migration deployment  | All 27 migrations applied; no historical backfill                                         |
| `pnpm test:integration`                         | 24 files, 219 tests passed, including 13 Rating checks                                    |
| `pnpm verify`                                   | Passed audit gate, lint, Knip, formatting, types, all 347 unit tests and workspace builds |
| Expanded UI smoke plus Rating/Watching contract | 58 passed; 390/768/1024/1440px, axe, keyboard, touch, reduced motion, focus and failures  |
| `pnpm test:journeys`                            | All 5 real-API journeys passed, including automatic and partial Rating completion         |

The final focused Rating journey rerun also passed both cases, including Session-heading focus
after automatic completion.

The expanded UI command is `pnpm exec playwright test --config playwright.ui.config.ts --grep
'@smoke|rating.spec.ts|watching.spec.ts' --grep-invert @visual`. Screenshots under `test-results/`
were inspected at phone and desktop widths; these are local artifacts, not hosted-preview evidence.
The dependency audit passed the high/critical gate with three existing moderate advisories.
The first full integration run exposed missing synthetic seed data and shared test-fixture Admin
limits; the final run used the repository seed and independent Rating fixtures. No runtime
permission, dependency or environment change was needed.

The repository has no hosted-preview workflow. #50 must remain unaccepted until its exact final
head SHA is hosted and the owner acknowledges the visual review. A Draft PR, local screenshots and
automated browser evidence do not satisfy that requirement.
