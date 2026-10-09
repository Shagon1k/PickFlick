# Phase 8 — Movie catalog

Phase scope and acceptance live in [ROADMAP.md](../ROADMAP.md#phase-8--movie-catalog-tmdb--global-search--in-progress).
[Project 3](https://github.com/users/Shagon1k/projects/3) owns live issue status.

## Delivery boundaries

- [#36](https://github.com/Shagon1k/PickFlick/issues/36) owns the provider adapter, canonical
  cache, and refresh jobs. Its recorded blockers #11 and #32 are closed.
- [#37](https://github.com/Shagon1k/PickFlick/issues/37) owns authenticated global search and UI.
- [#38](https://github.com/Shagon1k/PickFlick/issues/38) owns Movie Details, related titles,
  trusted links, and provider attribution in the visible experience.

The catalog module has no public routes yet. It exposes `MoviesService` to later backend modules;
the existing global authentication guard remains the boundary for future HTTP routes.

## Provider and cache contract

- The adapter uses TMDB v3 search and details with appended credits/videos in `en-US`.
  Search excludes adult titles and deduplicates IDs. Text stays plain text; consumers must
  escape it for their output context.
- Only fixed TMDB HTTPS endpoints receive the server-held read token. Redirects fail, and
  only validated relative image paths and YouTube trailer keys enter the canonical payload.
  Response bodies are capped at 4 MiB. Retry delays default to 60 seconds and are bounded
  between one second and one day before creating a cooldown timestamp.
- Provider failure is an explicit `unavailable` state. Validated cached data can be `stale`
  only after caller opt-in, within the configured age, for timeout, rate-limit, or transient
  availability failures. Invalid responses, removal, authentication, and disabled integration
  do not qualify.
- Native transactional upserts enforce one UUID per TMDB identity. Search summary freshness
  never refreshes details. Request start times prevent late older responses replacing newer
  metadata. Provider removal preserves a tombstone even before first ingestion, invalidates
  cached reads, and cannot be weakened by an older removal observation. Successful writes
  and stale fallbacks re-read the saved state before returning data.
- The additive migration creates `Movie` and `MovieSearchCache`; it does not change historical
  Session rows. Fixtures use synthetic metadata and no production poster imports.

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

## Verification evidence

- Full unit suite, including provider, service, environment, body-size, timeout, and input-contract
  tests: 280 passed on 2026-10-09.
- Full database/API integration suite: 75 passed on an isolated PostgreSQL 17 container, including
  concurrency, monotonic upsert, incomplete-detail, removal races, payload validation, and
  completeness constraints. All twelve migrations applied; rerunning found no pending migrations.
- Lint, knip, formatting, type checking, full workspace build, and Compose validation passed.
- `pnpm verify` stopped at the dependency-security gate because the existing `next@16.3.6`
  is affected by [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4).
  The GitHub advisory API confirms `16.3.8` as the first patched release. No dependency upgrade
  or security-policy exception is included in this issue.
- Live TMDB calls, user-facing screens, and refresh jobs: not verified.

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
