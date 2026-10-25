# Phase 15 — Personal Library, Ratings and Watchlist

[Roadmap Phase 15](../ROADMAP.md#phase-15--personal-library-ratings--watchlist--in-progress)
owns scope and acceptance. [Project 3](https://github.com/users/Shagon1k/projects/3) owns live status:
[#54](https://github.com/Shagon1k/PickFlick/issues/54) Personal Ratings,
[#55](https://github.com/Shagon1k/PickFlick/issues/55) Watchlist and
[#56](https://github.com/Shagon1k/PickFlick/issues/56) My Library.

Run `r_fa7102f33d2c421a6cd7` implements #54 on managed branch
`PF-54_15-1-implement-editable-personal-ratings`. The closed dependencies are #38, #50 and #52.
It reuses Session submission transactions, authenticated Movie routes, the star rating control and
focus-trapped popover. Watchlist, Library tables, historical imports and rating recomputation remain
outside this issue.

Migration 31 adds one PersonalMovieRating per User and Movie with a 1–10 score, PERSONAL or SESSION
source and update time. Apply it before the updated backend. It changes no existing history and
performs no backfill. Live Session submission updates the current opinion in the same transaction;
identical retries return before that update. A later personal edit or newer screening therefore
survives an older Session retry. Operator-entered past evidence does not set another user's opinion.

Movie Details reads the caller's current rating and opens the shared ten-star editor. Selection
shows N/10; Save rating persists it. Pending saves lock the editor, failures retain selection, and
Escape or outside dismissal returns focus. The Watchlist implementation is described below.

Verification covers database uniqueness/bounds, user isolation, historical preservation, concurrent
retries, repeat screenings, rollback, responsive keyboard/touch editing, offline/error recovery and
an end-to-end flow through the real API.

Local verification on 2026-10-25 uses Node 24.15.0 / pnpm 11.25.0 and a new disposable
`pickflick_test` database on loopback port 35432. All 31 migrations also apply to a second fresh
local database. The production audit passes its high/critical gate with two low and five moderate
findings. `pnpm verify` passes the audit, lint, Knip, formatting, type checking, all 352 unit tests
and every workspace build. All 251 integration tests across 28 files pass.

`pnpm test:ui:smoke` passes all 59 checks, including the five new Personal Rating checks.
All 13 real-API journeys pass, including Session → Movie edit → Completed history. Browser checks
cover 390/768/1024/1440px, keyboard/touch, axe, reload persistence and offline/API recovery. The
rating popover fits all ten 44px targets on larger screens and scrolls locally on phones. Save
feedback receives focus after the request settles, keeping Escape and focus return working.
Phone and desktop captures were inspected; visual baselines are unchanged.

The repository has no hosted-preview workflow. Exact-head hosted preview and owner visual
acknowledgment remain required before acceptance; local captures and a Draft PR do not satisfy them.

## Watchlist — issue #55

Run `r_4a8673a9ab5eb3fb97c9` implements #55 on managed branch
`PF-55_15-2-add-prioritized-personal-watchlist`; prerequisite #38 is closed.
The implementation reuses the authenticated API boundary, shared focus-trapped popover,
Movie poster ribbon, control shell and bounded table. Library Ratings, statistics, achievements,
search, filters and user-selected sort remain with their owning tasks, including #56.

Migration 32 adds only `WatchlistItem` and the LOW/MEDIUM/HIGH enum. The User/Movie primary key
prevents duplicates; native upserts preserve `addedAt`, priority edits replace one value, and
repeat deletes succeed. All queries take identity from the session. No history changes, backfill,
provider fan-out, new dependency or environment variable is introduced.

The first Movie ribbon activation saves Medium and opens its editor. Both Movie compositions
and the Library table read the saved state. The shared server action revalidates Movie and Library
after add, priority change or removal. Loading, empty, unavailable, offline and mutation errors have
explicit feedback. The Library row editor returns focus to its heading after removal.

Verification uses Node 24.15.0 and pnpm 11.25.0, retaining the launcher's workspace pnpm store.
A new disposable PostgreSQL container serves `pickflick_test` on loopback port 36432. All 32
migrations apply from empty. Schema comparison has no Watchlist drift; it reports existing
foreign-key ON UPDATE differences in ClubInvite, Movie cache and past-selection tables, which are
outside this issue. The first integration run omitted required synthetic fixtures; after the
idempotent seed, all 255 integration tests across 29 files pass. All 355 unit tests pass.
Lint, Knip, formatting, type checking and package/backend/frontend builds pass. The production
audit passes its high/critical gate (two low and five moderate findings).

All six Watchlist UI checks pass after a fresh build, covering 390/768/1024/1440px, keyboard/touch,
44px targets, axe, reload/navigation persistence, offline/API recovery, read failure, anonymous
redirects and focus after row removal. Phone and desktop captures under
`test-results/watchlist-{movie,library}-*.png` were inspected locally. Visual baselines are unchanged.
Focus return waits for the removed row's focus trap to unmount; hidden success feedback is fixed
inside the viewport so a horizontally scrolled table cannot widen the page.

The broad UI smoke run passed 63 of 65 checks before those final fixes. Its Watchlist mobile
overflow failure is fixed and covered by the six-check rerun. The other failure, Session roster's
“Operators share the Session link…” check, also times out on an isolated rerun at the Kick menu:
a decorative reel-break intercepts its click and the menu detaches. Session/menu files are unchanged;
this issue does not claim a clean full smoke suite. Final Watchlist checks use a temporary local
config on ports 41760/42761 because the initial test listener remains occupied. No committed test
configuration changes or test skips were introduced.

The real-API Watchlist journey and Personal Rating/Completed-history regression both pass:
`pnpm test:journeys tests/journeys/watchlist.spec.ts tests/journeys/personal-rating.spec.ts`.
The Watchlist journey checks duplicate HTTP retries against the saved database row and reloads
Movie Details after Library edits. Its navigation assertion waits for the Movie URL before reload.

Hosted exact-head preview and owner visual acknowledgment remain required before acceptance.
The repository provides preview Compose, but no hosted-preview workflow or authorized preview
resource is configured for this run. The issue stays open; a Draft PR and local screenshots do
not establish owner acceptance.
