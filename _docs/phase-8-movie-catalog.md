# Phase 8 — Movie catalog

Phase scope and acceptance live in [ROADMAP.md](../ROADMAP.md#phase-8--movie-catalog-sources--global-search--in-progress).
[Project 3](https://github.com/users/Shagon1k/projects/3) owns live issue status.

## Delivery boundaries

- [#36](https://github.com/Shagon1k/PickFlick/issues/36) owns the provider adapter, canonical
  cache, and refresh jobs. Its recorded blockers #11 and #32 are closed.
- [#37](https://github.com/Shagon1k/PickFlick/issues/37) owns authenticated global search and UI.
- [#38](https://github.com/Shagon1k/PickFlick/issues/38) owns Movie Details, related titles,
  trusted links, and provider attribution in the visible experience.

The catalog module exposes authenticated `POST /movies/search` and exports `MoviesService` for
other backend modules. The existing global authentication guard protects search. Movie Details
and the refresh worker remain separate delivery boundaries.

## Provider and cache contract

The implementation follows [ADR-017](decisions/README.md#adr-017--keep-movie-identity-independent-of-catalog-sources):

- `MoviesService` remains the facade; public DTOs and `details(movieId)` use canonical UUIDs.
- `MOVIE_PROVIDER` selects TMDB or the default PoiskKino + TheTVDB configuration.
  All selected sources share `CATALOG_ENABLED` and `CATALOG_TIMEOUT_MS`.
- Search uses PoiskKino. Details enrich through confirmed IMDb/TheTVDB mappings and cached
  source snapshots. Title/year never merges Movies; absent English descriptions remain null.
- External correspondences are separately unique. Transactions preserve UUIDs under concurrency,
  reject contradictory mappings and serialize overlapping batches to avoid lock inversion.
- Images support trusted HTTPS CDN URLs; ratings retain source/scale; trailers remain links.
  Poster/S3 copying and live response completeness are separate follow-ups.
- Every detail source retains its own locale/time. Search does not refresh details, and primary
  refresh does not renew enrichment. Failure and source removal are explicit in provenance.
- Stale use requires opt-in, bounded age and transient failure. Source tombstones preserve UUIDs,
  are monotonic, and require a strictly newer detail success for restoration. Every source removal
  survives an all-source failure and uses its own attempt-start clock.
- The additive source migration preserves UUIDs, valid external links and removal observations;
  legacy provider JSON caches are refilled under the new contract. Conflicting IMDb links fail
  migration for reviewed reconciliation. No Session history is rewritten.

## Refresh decision checkpoint

[ADR-016](decisions/README.md#adr-016--use-a-postgresql-queue-for-movie-refresh) proposes a
PostgreSQL queue and a worker entrypoint using the existing backend build. ADR-014 requires a
new queue decision at the first background job. Repository instructions require approval for
significant architecture choices and new dependencies. The engineering run requested the
developer's choice between PostgreSQL and the BullMQ/Redis default candidate before queue code.

The proposal specifies deduplicated jobs, transactional claims, retry/backoff, expired-lease
recovery, observable outcomes, and a validated cadence setting for the later Admin contract.
Refresh-job acceptance remains unverified until that checkpoint is resolved and the worker is
implemented. No Admin routes or permissions are introduced here.

## PR #160 source correction

The original review run prohibited migrations and left the developer's source/identity request
unimplemented. This correction includes the required additive migration, provider configuration,
normalized DTOs, independent source cache, adapter tests and ADR-017. ADR-016 remains separate.

## Verification evidence

- Full unit suite, including provider, service, environment, body-size, timeout, and input-contract
  tests: 280 passed on 2026-10-09.
- Full database/API integration suite: 75 passed on an isolated PostgreSQL 17 container, including
  concurrency, monotonic upsert, incomplete-detail, removal races, payload validation, and
  completeness constraints. All twelve migrations applied; rerunning found no pending migrations.
- Lint, knip, formatting, type checking, full workspace build, and Compose validation passed.
- Bounded CI repair upgrades `next@16.3.6` to the published `16.3.8` patch for
  [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), including matching
  environment and SWC packages. Frozen install, `pnpm security:audit`, and 43 focused audit-policy
  and frontend security tests passed on 2026-10-09. The existing braces exception remains guarded.
- Post-repair `pnpm verify` passed, including all 280 unit tests and the Next.js 16.3.8 production
  build. Lint reports one existing frontend ref-name warning and no errors.
- Post-repair `pnpm test:ui:smoke`: all 12 existing browser checks passed against Next.js 16.3.8.
- Review round 1: `pnpm verify` passed with 286 unit tests; the full database/API integration
  suite passed all 77 tests on isolated PostgreSQL 17 after applying the existing migrations
  and synthetic seed. Regression coverage includes equal-timestamp tombstones, interrupted
  body transport, overlapping cooldowns, and the canonical genre-name boundary. Lint retains
  the existing frontend ref-name warning. `pnpm test:ui:smoke` passed all 12 browser checks.
- Source correction: all 340 unit tests and all 82 database/API integration tests passed on
  2026-10-09. Coverage includes the one-logical-adapter boundary, provider switching without UUID
  changes, concurrent cross-source ingestion, conflicting records, missing English text,
  enrichment failure, independent source clocks and safe stale/removal races.
- The source migration was exercised against legacy Movie rows and preserved UUIDs, TMDB/IMDb
  mappings and removal observations. All thirteen migrations applied to the isolated PostgreSQL
  17 database; synthetic seed passed.
- Source correction: lint, knip, formatting, type checking, full workspace build,
  `pnpm security:audit`, Compose validation and all 12 browser smoke checks passed.
- Catalog simplification retained all 340 unit and 82 integration checks. Source clients now
  return direct normalized snapshots; the composite builds the unified result once. One shared
  HTTP transport serves all three APIs. The root contains module, service and repository;
  adapter code and tests are grouped under `providers/`.
- Review round 2: `pnpm verify` passed with 342 unit tests; all 85 database/API tests and
  12 browser smoke checks passed on 2026-10-10. Lint retains the existing frontend ref-name warning.
  Regression coverage includes both sources removed during a forced refresh, enrichment attempts
  ordered differently from service requests, and delayed HTTP removal timestamps. Compose
  validation passed with the shared catalog gate and timeout.
- Live provider responses, user-facing screens, poster copying, and refresh jobs: not verified.

## Provider terms

TMDB documents [search](https://developer.themoviedb.org/reference/search-movie),
[details with appended resources](https://developer.themoviedb.org/reference/movie-details),
and [rate limiting](https://developer.themoviedb.org/docs/rate-limiting). Do not assume a fixed
rate ceiling; handle `429` and its retry delay.

The [TMDB FAQ](https://developer.themoviedb.org/docs/faq) distinguishes commercial and
noncommercial use and requires approved logo attribution in an About/Credits surface.
Before exposing provider content, #37/#38 must include the required attribution. Commercial
licensing and production media rights remain an owner decision in
[#89](https://github.com/Shagon1k/PickFlick/issues/89); this issue grants no usage rights.

## Global search delivery (#37)

Run `r_ddd458f4a9fe7ca27119` adds a guarded, schema-validated search endpoint and connects the
existing product header through a server action. The service explicitly allows its existing
bounded transient-failure cache fallback. The UI debounces for 300ms, discards obsolete responses,
clears on dismissal, supports keyboard and touch, and renders provider text through React.

Canonical links use `/movies/[movieId]`. The issue's older TMDB-route wording is superseded by
Roadmap and ADR-017. The destination validates the UUID, checks the session, and preserves it
through sign-in; its details content is a handoff for #38. No new dependencies, migrations,
provider settings, background jobs, Personal Ratings or Watchlist operations are introduced.

Search renders neutral PF poster placeholders and source credits. The bundled TMDB logo comes
unchanged from its [approved logos page](https://www.themoviedb.org/about/logos-attribution),
with the notice required by the [TMDB FAQ](https://developer.themoviedb.org/docs/faq).
[TheTVDB attribution](https://thetvdb.com/api-information) links directly to its site when its
metadata appears. Attribution does not settle the commercial licensing decision in #89.

Verification on 2026-10-10:

- `pnpm verify` passed: security audit, lint (one existing ClubMembers ref-name warning), knip,
  formatting, type checking, all 355 unit tests, and the workspace build.
- All 85 database/API integration tests passed on a new isolated PostgreSQL 17 database after
  applying all thirteen existing migrations and the required synthetic seed. An initial unseeded
  run failed five fixture-dependent checks; the seeded rerun passed.
- All sixteen smoke checks plus search state and touch checks passed (18 browser checks).
  Search coverage includes keyboard navigation, escaped provider titles, focus return, clearing,
  whitespace edits, obsolete responses, empty/unavailable/rate-limited/disabled/stale states,
  mutual exclusion, outside dismissal, anonymous routing, and touch selection.
- Search axe checks and overflow checks passed at 390, 768, 1024 and 1440px. Local screenshots
  were inspected at mobile and desktop widths; no existing visual baselines were changed.
- Browser verification used the completed workspace build with a temporary copy of the standard
  mock runner/config on alternate loopback ports. Concurrent builds invalidated an earlier
  browser server; the isolated rerun passed. Temporary runner/config files were removed.

Hosted exact-head preview, live provider credentials/content and owner visual acknowledgement
remain unverified. No preview workflow or
GitHub deployment was available at preparation; local screenshots do not satisfy hosted review.
