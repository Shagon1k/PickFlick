# Phase 10 — Nomination

[ROADMAP.md](../ROADMAP.md#phase-10--nomination--deadline-automation--in-progress) owns scope and
acceptance. [Project 3](https://github.com/users/Shagon1k/projects/3) owns live status.

- [#42](https://github.com/Shagon1k/PickFlick/issues/42) delivers immutable submissions, personal
  history suggestions, privacy projections, progress and operator early closure.
- #43 owns durable deadlines and reconciliation; #44 owns automatic completion, outbox and live events.
- Run `r_c2ba7c3504e05da040d1` uses the managed branch
  `PF-42_10-1-implement-nomination-submissions-personal`.

## Delivery contract

Migration 17 adds Nomination storage with a unique participant/Session key, same-Session participant
foreign key, Movie foreign key and early-closure audit action. Existing data stays intact. Apply the
migration before running the new application image. No historical nominations are invented.

Submissions require an active Club Membership, accepted participation and an active Club in
Nomination. Club → Session locking serializes submissions, roster changes and closure. Duplicate
submissions conflict; existing nominations stay immutable. Departure preserves history and removes
that participant's nomination from current progress and early-close decisions.

The server uses Session visibility snapshots. When pre-submission visibility is off, callers who
have not submitted receive no nomination rows, including operators. Author visibility independently
removes author fields; no participant/nomination identifiers or timestamps accompany film rows.
Only aggregate progress is exposed. Suggestions use the caller's own earlier nominations in this
Club with a resolved winner in Watching, Rating or Completed, excluding the winning Movie. The
carousel offers up to twelve distinct Movies, newest nomination first. Cards select a Movie for
the same submission action as search; no saved-film entity is introduced.

Titles and years use existing validated catalog caches; absent metadata has an explicit placeholder
and a canonical Movie link. Progress refresh is manual until #44. Operators confirm early closure:
zero nominations cannot close, one selects that Movie for Watching, and two or more open Selection.
Closure increments phase/details versions and writes an audit event in the same transaction.

## Verification

- Node 24.15.0 and pnpm 11.25.0; dependencies installed from the frozen lockfile.
- All seventeen migrations apply to fresh isolated PostgreSQL 17.6. An upgrade probe from
  migration 16 preserves a Nomination Session's topic, phase, scale and versions and creates no
  nominations. The SQL diff still reports pre-existing ClubInvite/catalog foreign-key action drift;
  this migration leaves those definitions unchanged.
- `pnpm test:integration`: all 128 tests across fourteen files pass against the seeded isolated
  test database. Nine new checks cover concurrency, direct uniqueness/foreign-key enforcement,
  membership/phase/Club boundaries, hidden films/authors, suggestion isolation, departure and
  serialized audited early closure.
- `pnpm verify` passes: guarded security audit, lint, knip, formatting, types, all 388 unit tests
  across 43 files, and both builds. Lint has three existing warnings and one warning for the
  stateless nomination rows, which can repeat the same Movie and intentionally omit identity keys.
- The broad browser selection passes 58 behavior checks, including every PR smoke check,
  Nomination, Session creation and roster workflows, accessibility and overflow. The selection
  also picked two unchanged Session-shell visual checks, which differed outside the pinned image;
  both comparisons pass in the digest-pinned Playwright image used by CI. No visual baselines
  changed.
- The final focused Nomination suite passes all seven checks, including heading focus after early
  closure, Escape focus return, search/suggestion submission, locked success, failure/offline
  selection retention, axe and overflow at 390, 768, 1024 and 1440px. Desktop and mobile captures
  were inspected; the primary nomination controls precede secondary Session details.
- Staged gitleaks scan reports no leaks. Browser runs use temporary loopback ports because an
  interrupted test listener remained on the default ports; repository test configuration is unchanged.
- No dependencies, runtime variables, production deployment or secret files changed.

Browser checks use the mock API; the real API/database are covered by integration tests. Exact-head
hosted preview, a hosted multi-user journey and owner visual acknowledgement remain unverified.
Do not mark #42 or Phase 10 complete.
