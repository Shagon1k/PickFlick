# Area: C — Backend Movies, Library, Watchlist, Achievements

Read: `apps/backend/src/modules/movies/**` (service, repository, controller, catalog-cache-key, movie-images, personal-rating._, module, `providers/` composite, poiskkino, thetvdb, tmdb, movie-http, movie-provider, and all `__tests__`), `apps/backend/src/modules/library/**`, `apps/backend/src/modules/watchlist/**`, `apps/backend/src/modules/achievements/**` (service, controller, module, `rules/_`, all tests). Supporting reads: `packages/contracts/src/movies/\*.ts`, `tmdb.schema.ts`, Prisma models (Movie, caches, Session, Membership, AchievementAward, ClubInvite, enums), `StorageService`, `findMembership`, `recordAchievementNotifications`, `snapshotSchema`, the Movie Details page (`similarMovieIds`consumer); ROADMAP §3 (Club/Personal analytics, Achievement evidence and versions), Phase 8/15/16, Achievement criteria clarification; ADR-017 with amendments; ARCHITECTURE movie section.
Not read:`testing/achievement-fixtures.ts`, `testing/movie-fixtures.ts` only skimmed through their use in specs; frontend beyond the one consumer check (other areas).

No Must fix in this area: I found no bug with a high-impact wrong result, no security hole and no data loss. All 29 achievement rules match their written criteria (see "Checked and fine"); one card explanation is wrong (C3).

## Must fix

—

## Should fix

### C1. TheTVDB timeout + PoiskKino NOT_FOUND hides the stale cache (`apps/backend/src/modules/movies/providers/composite.provider.ts:37-39`)

- Case: the film was delisted from PoiskKino. Its merged details cache is older than `CATALOG_REFRESH_HOURS` but newer than `CATALOG_STALE_HOURS`. On refresh, PoiskKino returns 404 (the loader keeps it as `primary.error = NOT_FOUND`) and TheTVDB times out. The code then runs `throw primary.error ?? enrichment.error` and throws `NOT_FOUND`. `canUseStale('NOT_FOUND')` is false, so the Movie page shows "unavailable" instead of the stale cache. ADR-017 says: "no single-source NOT_FOUND marks the Movie UUID globally unavailable"; a transient error should give `stale`. No test covers this combination (`composite.provider.spec.ts:197` covers only "neither source knows the Movie").
- Fix: when both records are missing, throw the transient enrichment error first: `throw (enrichment.error && canUseStale(enrichment.error.reason) ? enrichment.error : primary.error) ?? enrichment.error ?? new MovieProviderError('NOT_FOUND')`. Add one case to `composite.provider.spec.ts`.
- Losing functionality: none. When both sources really return 404 / MISSING_EXTERNAL_ID, the result is still NOT_FOUND.

### C2. One bad PoiskKino document fails the whole search page (`apps/backend/src/modules/movies/providers/poiskkino.client.ts:46-51`, `:49`, `:51`, `:217`)

- Case: the wire schema accepts `externalId.imdb` as any string, and `year` / `movieLength` as any non-negative number. Then `parseSourceSnapshot` checks them against the strict contracts: `tt\d{7,12}`, `int().min(1800)`, `int().positive()`. Any one of 20 results with `imdb: "tt012345"` or `movieLength: 95.5` throws `INVALID_RESPONSE` for the whole `/movies/search` page. The user sees "provider unavailable" for every query that returns this film, and also for every type-ahead prefix. For images, the same file already does it right: `imageUrl … .catch(null)` drops only the bad field (and a test checks this, `poiskkino.client.spec.ts:144`).
- Fix: the same `.catch(null)` pattern at the boundary. `imdb: z.string().regex(/^tt\d{7,12}$/u).nullish().catch(null)`, `year: z.number().int().min(1800).max(3000).nullish().catch(null)`, `movieLength: z.number().int().positive().nullish().catch(null)`. Add a spec with one malformed doc next to a good one.
- Losing functionality: none. The bad value becomes unknown (`null`). Validation stays strict, and identity is never built from a malformed ID.

### C3. The Shared Taste explanation says undated screenings break the run, but they do not (`apps/backend/src/modules/achievements/rules/club-rules.ts:106-110`, `rule-catalog.ts:119-120`, `rule-sources.ts:10`)

- Case: `readAchievementSessions` sorts by `scheduledAt asc`, and PostgreSQL puts NULLs **last**. So an undated Completed Session always lands at the end of the list and never breaks a run in the middle. Example: A (Jan, average 8.5), B (no date, 9), C (Feb, 8.2), D (Mar, 8.1). The order becomes A, C, D, B, the run is 3, and the award is given. The card text promises "Missing averages or dates break the run". The `session.scheduledAt !== null` check only resets the counter after the last row, so it never changes `longest`: it is dead code that looks like a rule. ROADMAP requires that cards "state the version's precise evidence rule".
- Fix: remove the dead `&& session.scheduledAt !== null`. Change the v1 explanation to the real behaviour: "Undated screenings are skipped." Earned rows keep their own copy of the text, so only pending cards change. If the owner instead wants undated screenings to break the run, that is new behaviour and needs `version: 2`.
- Losing functionality: none. Awards stay exactly as they are now; only the text becomes true.

### C4. Each poster view downloads the full image from storage twice (`apps/backend/src/modules/movies/movie-images.service.ts:46`, `movies.controller.ts:61-71`)

- Case: `store()` checks whether an object exists by calling `storage.get(objectKey)`, which is a full `GetObject` plus `transformToByteArray()`: up to 5 MB into API memory. A search page with 20 results makes 20 requests to `/api/movies/:id/poster`. Each one downloads the whole image only to learn that it exists, answers with a `no-store` redirect, and then `/api/movies/images/:key` downloads the same object again to serve it. The Movie Details page does the same for its poster on every open. That is twice the latency and twice the memory per poster, and the redirect is never cached.
- Fix: add `StorageService.exists(key)` through `HeadObjectCommand` (the SDK already uses `HeadBucketCommand` for `ping`) and call it in `store()`. Give the redirect the same `private, max-age=86400` header as the image itself, because the target key is a content hash.
- Losing functionality: none. The image bytes and the URL contract stay the same.

### C5. `MovieSearchCache` grows with every typed prefix, and every poster scans the whole table (`apps/backend/src/modules/movies/movies.repository.ts:96-104`, `:145-149`; extends #70)

- Case: global search is type-ahead with a 300 ms debounce (`apps/frontend/src/components/movies/movie-search.ts:11`). Every pause ("the", "the m", "the ma", …) writes a new row of about 20 movies of JSON. No code deletes these rows. `findCachedPoster` finds a poster with `data #> '{movies}' @> [...]`. There is no index, so this is a sequential scan with detoast of every row. One poster request reads the whole table, and one search page makes 20 of them. The scan also returns rows from old `CACHE_VERSION` keys, although ADR-017 says a version bump "invalidates older normalized metadata".
- Fix (smallest): in `saveSearch`, in the same transaction, delete rows with `fetchedAt < now − CATALOG_STALE_HOURS`. Such rows are already unusable for search. Expired posters then fall back to the details cache, which is already the first lookup. If the owner prefers to keep the code unchanged, add a `shortcut:` comment with the limit and the condition to revisit (in the spirit of #70).
- Losing functionality: stale-safe search within `staleHours` stays. Poster lookup keeps working for recent searches and for every Movie whose details are cached.

## Nice to have

### C6. The ADR-017 section table no longer matches the merge (`providers/composite.provider.ts:83-108`)

- Case: the ADR-017 table says "Genres, directors and cast: TheTVDB English metadata, `null` when absent" and "Trailers: PoiskKino". The code falls back to PoiskKino English-named credits and dollar amounts, and prefers TheTVDB English trailers. ARCHITECTURE.md:351 already describes the code. Only the "Display titles" and "Poster availability" amendments exist, so a reader of the ADR gets the wrong precedence.
- Fix: append a short "Credits and trailers" amendment to ADR-017 (append-only, per AGENTS.md).
- Losing functionality: none; this is a documentation change.

### C7. A boolean positional argument, and an opt-in that no production caller declines (`movies.service.ts:83-86`, `movies.controller.ts:79`)

- Case: `this.movies.search(input, true)` does not say what `true` means. Every production caller opts into stale data: search through `true`; details through `{ allowStale: true }` in `getDetailsResponse` and `clubs.service.ts:70`. The `false` default is used only by specs.
- Fix (smallest): take an options object, `search(input, { allowStale: true })`, the same form as `getDetails`. If the owner agrees that stale data is always acceptable, remove the option from both methods and its specs, and amend ADR-017 ("to an opted-in caller").
- Losing functionality: none. Every production response stays the same.

### C8. A leftover per-source snapshot type validates every provider record twice (`providers/movie-provider.ts:13-54`)

- Case: `TSourceSnapshot` (`locale: z.literal('en-US')`, `fetchedAt`, `similarExternalIds`) is left over from `MovieSourceCache`, which the 2026-10-13 amendment removed. Each search result is now parsed by `sourceSnapshotSchema` and then again by `providerRecordSchema` in `toProviderRecord`. The `locale` field is never read. A newcomer sees two schemas and two `parse*` helpers for one record.
- Fix: keep one schema (the provider record plus `source`/`fetchedAt` for provenance), drop `locale`, and parse once in each client.
- Losing functionality: none. The same fields are validated at the same boundary.

### C9. Night Owl uses a clever hour test (`achievements/rules/personal-rules.ts:153-155`)

- Case: `getUTCHours() === NIGHT_HOUR && getTime() % HOUR_MS > 0` encodes "strictly after 23:00 on the same UTC date" through epoch alignment. A reader has to work this out.
- Fix: a named function `isAfterElevenPmUtc(date)` that checks `getUTCHours() === 23 && (getUTCMinutes() || getUTCSeconds() || getUTCMilliseconds())`. The existing test at `personal-rules.spec.ts:102` keeps the boundary.
- Losing functionality: none.

### C10. A test's name and its timers do not match what it proves (`movies/__tests__/movies.controller.spec.ts:184-234`)

- Case: the test name is "should return an eight-second search within its deadline despite three-second image ingestion". It uses fake timers, an 8 s mock and a 10 s race. The real assertion is `expect(storeMedia).not.toHaveBeenCalled()`: search never ingests images.
- Fix: rename it to "should not ingest images while searching" and remove the timers and `Promise.race`.
- Losing functionality: none. The same guarantee stays covered.

### C11. Details refresh reads the external IDs twice (`movies.service.ts:103-106` and `:149`)

- Case: when the cache is not fresh, `getDetails` calls `findExternalIds`, and `getDetailsResponse` immediately calls it again to build the outbound links. That is two identical queries for every refresh.
- Fix: `getDetails` returns the lookup it already loaded, or `getDetailsResponse` loads it once and passes it in.
- Losing functionality: none.

## Checked and fine

- **The 29 achievement rules match their criteria** (`club-rules.ts`, `personal-rules.ts`, `rule-catalog.ts`; 15 Club and 14 personal, counted):
    - Club: First Screening / The First Ten (Completed count incl. PAST and repeats); Full House / Critics Circle (members rebuilt at the scheduled date from Membership intervals, matched by userId across a rejoin; empty member set or no date never qualifies; attendance needs `attended === true`); Cult Classic (average ≥ 9, needs ≥ 1 response); Perfect Split (FULL_CYCLE frozen `ranking[0] − ranking[1] === 1`; PAST excluded); Double Feature / Marathon Night (UTC hour ≥ 18, bucketed by UTC date; midnight date-only entries excluded); Decade Tour / Silent Era (`< 1930`, known year); World Tour (distinct `productionCountries` from the configured cache key, old rows add nothing); Packed Calendar (UTC month); Genre Roulette; Comeback (≥ 30 days between consecutive dated screenings); Shared Taste (apart from C3).
    - Personal: Opening Credits; First Vote; Reliable Viewer / Never Miss (one run per Membership interval; unknown attendance and non-participation break the run); Critic; Panda Patron (`accepted` and responder ≠ self); Nominator (live plus attributed PAST); Taste Maker (nomination ID equals the frozen winner); Genre Scout; Archivist (distinct IDs); Long Review (capped at 301, length only, no text); Night Owl (strictly after 23:00, same UTC date); Early Bird (first SELECTION-phase progress event, ≤ 3 h); Hot Take (|score − average| ≥ 2, average includes the caller, only while an ACTIVE membership can read the results).
    - Product note, not a finding: PAST imports dated before a Membership's `joinedAt` cannot count toward Full House, Critics Circle or attendance streaks, because ROADMAP rebuilds membership "at the scheduled date". The owner should know this is how the written rule behaves for Clubs that import history from before they joined.
- Award writing: `createManyAndReturn({ skipDuplicates })` plus unique `(key, version, userId|clubId)` gives at most one award, and notifications go only to the rows that were inserted. Private Club awards notify only Admins/Moderators. Members see current private cards with no state, and retired private rows are left out. Club reads use `findMembership` (ACTIVE, not deleted; archived Clubs allowed).
- Evidence contains no comment text, image URLs or credentials (`commentLength`, `hasProfile` only).
- Library statistics match ROADMAP: one row per Movie, PERSONAL and SESSION both count, UTC-year `updatedAt`, empty Library gives zero hours and null averages/favourites, a missing, empty or invalid cache makes the whole summary null, each name counts once per film, ties break by code-unit order, the RepeatableRead snapshot is shared with the Watchlist count.
- Library list: LIKE wildcards escaped, deterministic `movieId` tie-break, page clamped, count and rows in one snapshot. Watchlist priority `desc` follows enum order LOW < MEDIUM < HIGH.
- Personal Rating and Watchlist: every query is scoped by `userId` from the session; the Movie must exist (404); native unique upsert; deletion is idempotent.
- Provider boundary: bounded body (4 MB / 5 MB images), `redirect: 'error'`, timeouts, Retry-After clamped to 1 s–24 h and shared per client, allowlisted image hosts, YouTube-only trailers, IMDb confirmation for TheTVDB remote-ID matches, ambiguous candidates are a conflict, TMDB adult filter, IDs re-checked against the request.
- Identity: one advisory lock serializes catalog writes; a search skips conflicting records; single-ID related titles cannot conflict; summary columns are never erased by sparse data.
- Cache: one freshness rule; a future `fetchedAt` is never fresh; an older cache shape counts as a miss; the key hashes provider, locale and version. `forceRefresh` is used only in specs, but it is the hook for the planned scheduled refresh (Phase 8 / ADR-016), so it stays.
- Related titles: PoiskKino does not deduplicate or exclude the film itself, but the Movie page does both (`movies/[movieId]/page.tsx:51-53`).
- Already reported, not repeated: #5, #14, #15, #16, #17, #18, #19, #30, #31, #40, #41, #51, #65, #70.

Dropped smaller items: 3 (the TMDB-only related-title dedupe repeated on the page, `findSummaries` reading metadata outside `tx`, case-sensitive search cache keys).
