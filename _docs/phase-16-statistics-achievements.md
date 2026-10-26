# Phase 16 — Statistics and achievements

This active phase supports [Roadmap Phase 16](../ROADMAP.md#phase-16--clubpersonal-statistics--achievements--in-progress).
Project 3 owns issue status: [#57](https://github.com/Shagon1k/PickFlick/issues/57) covers Club
statistics and rankings, [#58](https://github.com/Shagon1k/PickFlick/issues/58) personal analytics,
and [#59](https://github.com/Shagon1k/PickFlick/issues/59) achievements.

## Club statistics — issue #57

Run `r_b69577eb70c8bf70dd28` uses managed branch
`PF-57_16-1-deliver-club-statistics-ratings`. Prerequisites #51 and #53 are closed.

Reuse the Hub's repeatable-read snapshot, active Membership checks, existing plan adapter,
immutable SessionRating records, cached Movie metadata and bounded UI table. No migration,
provider refresh, billing integration, dependency or environment change is planned.

Free projects completed and UTC calendar-year counts. Pro adds watch hours, genre/director/actor
summaries, permitted historical rating averages and Movie rankings. Admins and Moderators may
aggregate all completed results; Members only aggregate Sessions whose saved `showRatingResults`
is true. Apply that filter before computing averages or ranking. Individual scores, comments,
participant identities and hidden rating counts do not enter the analytics response.

Count each completed screening, including repeat viewings and PAST imports. Open and Cancelled
Sessions do not contribute. Average every received historical rating with equal weight, including
responses retained after departure; missing ratings are unknown. Group rankings by canonical Movie
ID; deterministic ties use Movie ID. Missing Movie metadata leaves the affected summary unavailable across the whole completed set. Metadata summaries
reflect the existing validated cache; refreshing metadata can change descriptive summaries but
cannot change completed counts or historical rating aggregates. No awards are created here.

Verification: canonical aggregate fixtures, role/plan filtering and real-API membership denial;
responsive Ratings sorting, empty/loading/error states, keyboard/touch and accessibility at
390/768/1024/1440px; normal static checks and relevant regression suites. Exact-head hosted preview
and owner visual acknowledgment are required before acceptance. Preview Compose exists, but the
repository currently has no hosted-preview workflow; local captures do not satisfy that criterion.

## Personal statistics — issue #58

Run `r_93ab5e32cb67e9c1cd67` uses managed branch
`PF-58_16-2-deliver-deterministic-personal-library`. Prerequisite #56 is closed.

Reuse the authenticated Library module, PersonalMovieRating and WatchlistItem storage, configured
Movie cache, repeatable-read transactions, stat icons, brand image, control shell and mutation
revalidation. The strict private/no-store `GET /library/statistics` endpoint accepts no user or
filter selectors. Its pure calculator counts current rated Movies, current UTC-year rating updates,
equal-weight current average, estimated one-viewing watch time, all Watchlist priorities and
genre/director/actor frequency. Exact cached names count once per film, with code-unit tie order.
Missing metadata leaves only the affected summaries unavailable. Identical inputs reproduce the
same output; refreshing the configured cache intentionally changes descriptive values without
changing saved personal activity. Historical Session Ratings are not inputs or outputs.

The eight tiles appear above both Library tabs with four desktop columns and two below L. Full
names wrap, empty values remain honest and read errors have independent retry feedback. No schema
migration, dependency, environment setting, achievement, billing, catalog request or refresh worker
is added. Watch time is an estimate and yearly activity is the latest opinion update, as explained
in the UI and canonical rules. The read cost grows with the user's rated-film count.

Verification plan: deterministic aggregate fixtures (UTC bounds, duplicate credits, ties, partial
and obsolete cache, refresh/recompute); real API isolation, strict query rejection and save/retry
updates; browser checks at 390/768/1024/1440px for long content, empty/error recovery, table-filter
independence, mutation refresh, keyboard/touch and axe; existing Library/editor regressions and
`pnpm verify`. Hosted exact-head preview and owner visual acknowledgment remain required for
acceptance. Local screenshots and a Draft PR do not establish those requirements.

## Personal verification

Node 24.15.0 / pnpm 11.25.0 use the launcher's workspace store. A new disposable PostgreSQL
container serves only `pickflick_test` on loopback port 41432. All 32 existing migrations and the
idempotent synthetic seed apply; no product migration or secret-file change is introduced.

All 267 integration checks across 33 files pass, including three new statistics API checks for
identity isolation, strict query rejection, configured-cache selection, refresh/recompute, empty
and obsolete metadata, rating edits and Watchlist retries. Five pure calculator fixtures cover all
eight values, UTC year boundaries, duplicate credits, deterministic ties and unchanged retries.
`pnpm verify` passes the production audit, lint, Knip, formatting, type checking, all 393 unit tests
and every workspace build. The audit passes its high/critical gate with two low and five moderate
findings. The staged gitleaks scan passes without an allowlist change.

All five statistics browser checks pass, including 390/768/1024/1440px, full long-name wrapping,
two/four-column composition, axe, table-filter independence, both tabs, reload, keyboard/touch
editing and refreshed averages, empty values and retry recovery. All 19 existing Library,
Personal Rating and Watchlist checks pass too. Initial browser checks exposed invalid definition-list
nesting and a sidebar-grid placement conflict; both are corrected. The mobile test also stopped
targeting a tab link while its menu was closed. Styles use the repository's 576px compact breakpoint.

The full smoke selection passes 82 of 83 checks. Its only failure is the unchanged Session roster
clipboard assertion: it expects origin port 41730 but correctly receives this run's 41840 origin.
No Session test, skip, visual baseline or product behavior is changed to bypass it. The previous
Nomination progress failure does not reproduce in this run. Temporary UI configuration lives under
ignored `test-results/`; the app copy there keeps later verification builds from changing the test
server. The standard UI ports were already occupied.

`pnpm test:journeys tests/journeys/library.spec.ts` passes through the real API and database,
including the new all-Library statistics assertions across pagination, filters and Watchlist.
Local phone/desktop captures were inspected; four-width long-content captures are under
`test-results/library-statistics-*.png`. Full visual baseline comparisons are not claimed.

Exact-head hosted preview and owner visual acknowledgment remain required before acceptance.
The repository has preview Compose but no hosted-preview workflow or authorized destination for
this run. Local captures and a Draft PR do not satisfy that criterion; the issue remains open.

## Club verification

Node 24.15.0 and pnpm 11.25.0 run with the launcher's workspace pnpm store. A disposable
PostgreSQL container serves only `pickflick_test` on loopback port 40432. All 32 existing
migrations and the idempotent synthetic seed apply; no product migration is added.

All 264 integration checks across 32 files pass. The final four-check analytics rerun also passes
after strengthening the weighted-average fixture and adding an edited Personal Rating. The API
fixtures cover repeated and partial PAST screenings, retained departed responses, open/Cancelled
exclusion, role changes, saved visibility, Free/Pro projections, archived Club reads, denial to anonymous users and foreign App Admins,
and malformed queries. The initial departure fixture omitted
its required timestamp; the corrected fixture passes.

The final `pnpm verify` passes the production audit, lint, Knip, formatting, type checking,
all 388 unit tests and every workspace build. The focused statistics and sign-in continuation
suites also pass all 45 checks. The production audit has two low and five moderate findings,
passing its high/critical gate. The staged gitleaks scan passes without an allowlist change.

All eight Club Ratings browser checks pass on the built app at 390/768/1024/1440px. They cover
keyboard/touch, axe, 44px Film links, bounded page/local table scrolling, sort and page URL state,
reload/sign-in continuation, offline feedback, empty/Free/invalid/denied states, API retry recovery,
plan-specific Overview tiles and the prefetched loading boundary. All 13 existing Hub behavior
checks pass as well. The initial retry check clicked before the initial render settled; it now uses
the shared settle helper. A broader run hit a Playwright trace-file ENOENT during phone context
closure after its assertions passed. The clean eight-check rerun uses its own artifact directory
and waits for the final sort transition before closing the context.

Phone and desktop captures under `test-results/club-ratings-{390,768,1024,1440}.png` were inspected
locally. Baselines are unchanged. Temporary configuration used 41800/42801 because the standard
UI ports were occupied; it has been removed. The matching cached Playwright browser was reused
after its installer stalled without output. Full visual comparisons and real-browser API journeys
are not claimed by these focused checks.

Exact-head hosted preview and owner visual acknowledgment remain required before acceptance.
The repository has preview Compose, but no hosted-preview workflow or destination is configured
for this run. Local captures and a Draft PR do not satisfy that requirement. The issue stays open.
