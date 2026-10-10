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
other backend modules. The existing global authentication guard protects search. Movie Details uses the same authenticated catalog service. The refresh worker remains a separate delivery boundary.

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

## Movie Details delivery (#38)

Run `r_56f259d52bb49b2a7422` delivers the shared read-only canonical UUID route. The detail
endpoint reuses `MoviesService.details` with bounded stale opt-in and returns backend-built links.
The browser receives schema-validated data and escaped text; missing/failed posters use neutral
placeholders. Responsive composition follows the canonical Movie Details hero, with outbound
YouTube trailers under the existing adapter contract. TMDB related identifiers now resolve through
the canonical repository; a streamed section loads up to six related titles independently.

IMDb links are built on the backend from stored identifiers. Wikipedia is an explicitly labelled title search on a fixed
trusted origin; providers currently supply no verified article mapping. No article URL is inferred.
TMDB credits reuse the approved logo and required notice in a visible Catalog credits section,
following the [TMDB FAQ](https://developer.themoviedb.org/docs/faq) rechecked on 2026-10-10.
TMDB's [similar-title endpoint](https://developer.themoviedb.org/reference/movie-similar) supplies
related identifiers without AI personalization. Credits do not settle commercial licensing or
image rights in #89. No prototype film images/stills ship as production data.

No dependency, migration, refresh job, provider setting, Personal Rating or Watchlist operation
is introduced. Exact-head hosted preview and owner acknowledgement remain required before
completion. The repository has no preview workflow and GitHub reported no deployments at preparation.

Verification on 2026-10-10:

- `pnpm verify` passed: security audit, lint, knip, formatting, type checking, all 361 unit
  tests and the workspace production build. Lint has one existing ClubMembers warning and two
  index-key warnings on immutable provider lists, with no errors.
- The sandbox initially blocked pnpm's dependency listing because it opens the shared SQLite
  package-store index for writing. The unchanged gate passed with a temporary writable copy of
  that package metadata; installed dependency bytes, lockfile and audit policy were unchanged.
  Generated pnpm metadata was restored after verification.
- All 85 database/API integration checks passed on a new isolated PostgreSQL 17 database after
  applying all thirteen existing migrations and the synthetic seed. The seed guard first rejected
  a noncanonical test database name; the rerun used the required `pickflick_test` database.
- All 26 browser smoke checks passed. After the desktop grid correction, all 19 focused Movie
  Details/search checks passed on the final code, including missing media, failed posters,
  missing identifiers, stale/partial/error states, unknown UUIDs, malformed routes, related-provider
  failure, keyboard/touch navigation and desktop media/credits geometry.
- Movie Details axe and page-overflow checks passed at 390, 768, 1024 and 1440px. Mobile and
  desktop screenshots were inspected; no existing visual baselines were changed.
- Live provider credentials/content, hosted exact-head preview and owner visual acknowledgement
  remain unverified. Local screenshots do not satisfy the hosted-review acceptance criterion.

## Movie Details review fix round 1 (#38)

The owner-approved snapshot at `7601b2fc104500054c37b335b60ff02d364759bf` covers three
threads on PR #164. Details now return backend-built `links.imdb` without external IDs.
The backend copies catalog media into private S3-compatible storage and returns authenticated
same-origin image paths; CSP no longer permits provider image hosts. Downloads reject redirects,
validate raster signatures, and enforce five-second and 5 MiB limits. Existing objects are reused;
failed downloads retain the missing-media presentation, and storage failures propagate.
Provider URLs remain in internal caches, so no migration or infrastructure change is needed.

The detail transport deadline is 100 seconds: three provider calls can each consume the configured
30-second maximum, followed by concurrent image downloads and response overhead. Other API calls
keep their ten-second deadline. Delayed-provider regressions cover complete details after three
four-second calls and partial details after late enrichment timeout.

Verification on 2026-10-10:

- `pnpm verify` passed: security audit, lint (three existing frontend warnings), knip, formatting,
  type checking, all 376 unit tests, and the workspace production build.
- The audit used a temporary writable copy of pnpm's shared SQLite store metadata, as in the
  original run. Installed dependencies, lockfile and audit policy were unchanged.
- All 85 database/API integration checks passed on an isolated, seeded PostgreSQL 17 database
  with the existing thirteen migrations. The first attempt lacked runtime test configuration;
  the rerun used the repository's synthetic environment defaults.
- All 26 browser smoke checks passed, including Movie Details links, missing/failed media,
  rate-limit/disabled feedback, accessibility and overflow at four widths. The first browser run
  exposed an old inline external-ID field in the mock; the corrected fixture and final code passed
  the full static gate and the smoke rerun. No visual baselines were changed.
- Live provider content, live S3 media delivery, hosted exact-head preview and owner visual
  acknowledgement remain unverified. Storage is mocked in the focused image checks.

## Movie Details review fix round 2 (#38)

The owner-approved snapshot at `0f9b396069496d545dedb3a0f98fdd018aeeaa20` covers two
threads on PR #164. Search returns null poster and backdrop fields without image downloads
or storage reads, including cached results. Details ingest only the displayed poster and
return null backdrops and cast portraits while preserving cast names and characters. Provider
URLs remain in internal caches; poster validation, download limits and storage failures keep
the existing behavior.

Focused regressions cover fresh/stale search projections, an eight-second search with a
three-second image delay, and one poster operation for a 50-person cast. Live provider and S3
traffic, hosted exact-head preview and owner visual acknowledgement remain unverified.

Verification on 2026-10-10:

- `pnpm verify` passed: security audit, lint (three existing frontend warnings), knip,
  formatting, type checking, all 379 unit tests and the workspace production build.
- All 26 PR browser smoke checks passed with an isolated-port temporary configuration after
  the default port was occupied. No screenshot baselines changed.
- The initial static gate caught a missing failure reason in the new stale-result fixture;
  the fixture was corrected before final verification.
- pnpm's shared SQLite store metadata was copied to a temporary writable directory for the
  audit; dependencies, the lockfile and audit policy were unchanged.
