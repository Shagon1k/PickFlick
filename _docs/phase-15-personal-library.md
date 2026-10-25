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
Escape or outside dismissal returns focus. Watchlist remains a placeholder for #55.

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
