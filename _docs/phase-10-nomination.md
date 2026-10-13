# Phase 10 — Nomination

[ROADMAP.md](../ROADMAP.md#phase-10--nomination--deadline-automation--in-progress) owns scope and
acceptance. [Project 3](https://github.com/users/Shagon1k/projects/3) owns live status.

- [#42](https://github.com/Shagon1k/PickFlick/issues/42) delivers immutable submissions, personal
  history suggestions, privacy projections, progress and operator early closure.
- #43 owns durable deadlines and reconciliation; #44 owns automatic completion, outbox and live events.
- Run `r_c2ba7c3504e05da040d1` uses the managed branch
  `PF-42_10-1-implement-nomination-submissions-personal`.

## Delivery contract

### Automatic transition run — #44

Run `r_fb766f7d2d2de3c3cc83` uses the managed worktree
`~/_projects/.worktrees/pickflick/PF-44_10-3-serialize-automatic-nomination-transitions/PickFlick`
and branch `PF-44_10-3-serialize-automatic-nomination-transitions`, starting at `3210f0c`.
Preparation confirmed a clean checkout, Shagon1k/PickFlick origin, native blockers #42 and #43
closed, and Project 3 In progress. The autonomous issue-scoped run authorizes focused commits,
normal same-branch pushes and one Draft PR; merge and production deployment remain unauthorized.

Reuse Club → Session locks, deadline invalidation and the authoritative filtered Session detail.
Check completion after nomination and roster changes, including Club departure and reactivation.
Zero accepted nominations stay open; one selects the sole Movie; multiple nominations open Selection,
including repeated Movies. Keep automatic decisions and progress/notification intent in the same
transaction through a Session-specific PostgreSQL outbox. Add no dependency or process.

Version-only SSE signals revalidate Session detail. Send the current version on connection and each
five-second heartbeat, with authentication and membership rechecked each time. Clients compare the
signal to the rendered version; stale signals do nothing, gaps and reconnects cause a fresh read.
A fifteen-second snapshot fallback and focus/online refresh cover stream failure. Film rows and
nominator identities remain only in the existing filtered detail response.

Verification plan: concurrent final submissions; zero/sole/multiple and repeated Movies; departure,
removal and archived/reactivated roster changes; deadline/manual races; outbox failure rollback;
real session revocation/expiry/suspension; multi-client stream and reconnect; browser live progress,
offline recovery and polling; fresh and migration-18 upgrade probes; `pnpm verify`, integration and
UI smoke checks. An exact-SHA hosted preview and owner visual acknowledgement are required before
issue completion. Selection scoring and notification inbox/email delivery remain out of scope.

### Automatic transition verification — 2026-10-13

Migration 19 and the Session-specific progress outbox implement #44 within its authorized scope.
The shared Nomination transition is used by submission, roster, manual and deadline paths. Stream
headers disable compression/proxy buffering, and the client permits one online refresh transition
at a time. These address observed browser buffering and overlapping-refresh failures during offline
recovery. API shutdown finishes active streams; disconnect releases polling subscriptions.

- Node 24.15.0 / pnpm 11.25.0; frozen installation with the launcher’s in-worktree store.
- All nineteen migrations apply to fresh isolated PostgreSQL 17.6. Applying migration 19 after
  migrations 1–18 preserves every field of an existing Nomination Session, defaults progress to 1
  and creates no historical events.
- All 167 integration checks across seventeen files pass. Seventeen focused progress/auth checks
  cover concurrent final submissions and departure, repeated Movies, sole/zero outcomes, removal,
  returning nominees, archived/reactivated completion, deadline races, actual outbox rollback,
  two clients, old event cursors, access loss, authentication revocation/expiry/suspension and
  API shutdown with an open stream. Existing deadline/roster/visibility checks pass.
- The final browser selection passes all forty checks: every one of the thirty-three PR smoke
  checks plus all nine Nomination checks. Duplicate and older signals do not regress the page;
  reconnect after an offline phase change and stream-blocked polling recover current state.
  Keyboard focus, axe and page overflow pass at 390, 768, 1024 and 1440px. Mobile and desktop
  captures were inspected; visual baselines are unchanged.
- `pnpm test:worker` passes for overdue repair, durable empty outcome, process restart and SIGTERM.
  `pnpm deploy:check` renders all Compose definitions. Backend and root type checks and the final
  backend build pass.
- `pnpm verify` passes with the repository’s existing guarded audit exception, four existing lint
  warnings, knip, formatting, workspace/root types, all 392 unit tests and both production builds.
  The final static gate also passes after client/shutdown refinements.

The first broad smoke attempt was disrupted by a simultaneous production build replacing its
server files. The clean sequential browser rerun above passes; no repository workaround is kept.
Local gitleaks is unavailable; the unmodified hook reports a skipped local scan, while CI secret
scan remains required. No dependencies, runtime variables, topology, credentials, billing,
permission changes, merge or production deployment are included.

Hosted exact-head preview, hosted multi-user verification and owner visual acknowledgement remain
unverified. Browser checks use the mock API; real multi-user API streams and transactions are
covered by integration tests. Keep #44 and Phase 10 open until the remaining acceptance evidence
is recorded. The managed worktree remains for review; this run created no manual worktree.

### Deadline run preparation

Run `r_f9f677f7afc97df8107e` for [#43](https://github.com/Shagon1k/PickFlick/issues/43) uses the
managed branch `PF-43_10-2-automate-nomination-deadlines-with`, starting at `3d198a0`.
Its native blockers #39 and #13 are closed; nomination storage and manual closure are present.

The acceptance boundary is zero/one/many nominations at deadline, idempotence across duplicate,
stale, restarted, edited and cancelled jobs, and observable repair of missed overdue deadlines.
Automatic completion on submission, live progress transport and notification delivery remain
separate work under #44 and the later notification phase.

[ADR-018](decisions/README.md#adr-018--persist-nomination-deadline-jobs-in-postgresql) approves a
Nomination-specific PostgreSQL job table and separate backend worker, with the implementation
impact and verification plan. It reuses Club → Session serialization and avoids new dependencies.
The developer approved ADR-018 on 2026-10-13 in the Kurami recovery conversation, satisfying the
architecture checkpoint required by ADR-014 and repository guidance. Continue issue #43 within
that accepted scope. ADR-016 remains a separate, unaccepted Movie refresh proposal.

Preparation changes documentation only. Deadline tests, migrations, worker builds and runtime
checks have not run; the issue's acceptance criteria remain unverified.

### Managed successor implementation — 2026-10-13

The owner ended the predecessor Remote task and authorized this fresh managed continuation on the
same issue, worktree and branch. The existing preparation edits were reconciled with open #43 and
Project 3 In progress; no PR, CI checks or review findings existed at intake.

Migration 18 implements ADR-018. Session creation and deadline edits persist jobs transactionally;
clearing, cancellation and manual closure invalidate pending intent. Deadline decisions use accepted
participants' nominations, count repeated Movies separately and serialize Club → Session → job.
`NominationDeadlineDecision` is the automatic audit without a fabricated human actor;
`NominationDeadlineNotification` retains recipient intent atomically. Delivery and completion on
submission remain separate work. The independent backend worker reconciles on startup and every
five seconds, pauses archived Clubs, logs safe outcomes/lateness/failures and shuts down gracefully.
Local scripts, CI, worker image target, preview/UAT topology and operational health checks include it.

Verification evidence:

- Node 24.15.0 and pnpm 11.25.0; pnpm's store remains inside this worktree.
- All eighteen migrations apply to fresh isolated PostgreSQL 17.6. An upgrade from migration 17
  preserves an existing Nomination Session's topic, deadline, phase/details versions and scale;
  `deadlineVersion` defaults to 1 and no scheduling intent is invented by the migration.
- `pnpm test:integration`: all 150 tests across fifteen files pass after loading the deterministic
  seed. Twenty-one deadline checks cover exact clock boundaries, zero/one/many, repeated Movies,
  departed participants, edits, clearing, cancellation, manual/worker races, duplicate workers,
  archived/reactivated Clubs, missing intent, restart recovery and safe logs. Real database failures
  at replacement scheduling and final completion prove transactional rollback and retry.
- Two worker-loop unit checks pass for shutdown during current work and safe retry after failure.
- `pnpm test:worker` passes against the built entrypoint: startup overdue repair, durable empty
  decision, process restart and SIGTERM shutdown.
- `pnpm test:ui:smoke`: all 32 checks pass, including existing Nomination, Session creation,
  editing/cancellation and roster workflows. Browser checks use the mock API; deadline transitions
  are covered by the real API/database integration suite.
- `pnpm deploy:check` passes for local, preview and deploy definitions.

- `pnpm verify` passes: guarded security audit, lint (four existing frontend warnings), knip,
  formatting, workspace/root types, all 392 unit tests across 44 files and both builds.
- Local gitleaks is unavailable; the repository hook reports its skipped scan. GitHub's secret-scan
  check remains required. No hook is bypassed.

- `pnpm build:images` passes from clean implementation commit `a9dd59f`, building all four targets.
  Buildx metadata uses a temporary `/tmp` directory because the managed filesystem keeps the home
  Docker configuration read-only. Repository build definitions and credentials are unchanged.
- The packaged worker runs read-only, without capabilities, against the isolated upgrade database.
  It repairs the preserved overdue Session, records one empty decision, becomes healthy, exits 0 on
  SIGTERM, and becomes healthy after restart without repeating the decision. Its test container is removed.
- GitHub CI for `a9dd59f` passes Secret scan, Dependency security, Lint/type-check/test, Integration
  and runtime smoke, UI smoke, Production images and Delivery gate. PR-only CI correctly skips the
  full UI contract/visual selections. No review findings were present at this verification point.

Draft [PR #170](https://github.com/Shagon1k/PickFlick/pull/170) contains the issue-scoped result.
Hosted environment behavior and owner acceptance remain unverified here. No production deployment, secrets, dependencies,
new environment variables, permission changes or unrelated product work are included.

### Recovery preparation

On 2026-10-12, Project 3 reads succeeded with the existing managed-writer credentials via
`gh api graphql`, querying `user(login: "Shagon1k").projectV2(number: 3)`. Issue #43 is open
and its Project status remains In progress. The installed `gh project` owner lookup is not
required; do not change credentials or token scopes to work around it.

`pnpm install --frozen-lockfile` passed with Node 24.15.0 and pnpm 11.25.0, including shared
configuration build and Prisma Client generation. The managed launcher now sets
`pnpm_config_store_dir` to `node_modules/.pnpm-store` inside the worktree, keeping pnpm's
SQLite/WAL writes within the workspace. Preserve that setting when continuing.

The saved preparation edits remain in this worktree. The developer has now approved ADR-018.
Recovery checks do not by themselves resume the run or prove deadline acceptance.

### Nomination submissions

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

Titles and years use the Movies boundary’s cache-only summaries from validated catalog caches.
Details and source metadata take precedence over search metadata; search-only nominations keep
their known title and year without a detail request. Absent metadata has an explicit placeholder
and a canonical Movie link. Progress refresh was manual before #44; the automatic-transition run adds version signals. Operators confirm early closure:
zero nominations cannot close, one selects that Movie for Watching, and two or more open Selection.
Closure increments phase/details versions and writes an audit event in the same transaction.
Session detail owns phase, the details `version`, the explicit `phaseVersion` and nested nomination
data; closure accepts `phaseVersion`. Current nomination rows derive from the accepted participant
query. Refresh and successful mutations revalidate the page without a second nomination fetch or a
client projection copy. Successful submission focuses the stable nomination heading.

The separate Nomination table keeps immutable submission history when roster status changes and
already enforces uniqueness and same-Session linkage. This review fix retains that storage and its
constraints without a migration.

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

## Review fix round 1

The bounded owner-approved round starts from PR #169 head
`b779199d9973a400eadb4d8b058ed82efb88d549` and addresses only the two submitted threads.

- `pnpm verify` passes with all 389 unit tests and both builds; lint retains four existing warnings.
- All 128 integration tests pass against a migrated, seeded isolated PostgreSQL 17.6 database.
  Closure checks deliberately separate details and phase versions and reject a details-version token.
- `pnpm test:ui:smoke` passes all 32 checks.
- All seven focused Nomination browser checks pass, including keyboard submission focus, manual
  refresh, early-close focus, failure/offline selection retention, axe and overflow at all four
  canonical widths. Catalog summary tests cover validated details, source fallback and missing
  metadata without provider calls.
- Authorization, visibility filtering, Club → Session locking, audit and database constraints remain
  covered by the integration suite. No migration, dependency, permission or infrastructure change
  is included. The issue remains in Human Review; hosted exact-head evidence and CI are left to
  the managed review workflow.

## Review fix round 2

The bounded owner-approved round starts from PR #169 head
`2aab1e07611ef82fcb4b9d18fc6cf853edd44f2a` and addresses only the submitted search-metadata thread.

- Cache-only summaries validate matching search-cache rows and use their newest metadata when
  details and source metadata are absent. Submission and projection make no provider request.
- All 129 integration tests pass, including search → submit → Session projection with no details
  or source cache. The projection retains the searched Movie's title and year.
- All 27 focused Movies service tests pass, including invalid search metadata, newest search
  metadata, original-title fallback and details precedence.
- `pnpm test:ui:smoke` passes all 32 checks.
- `pnpm verify` passes with all 390 unit tests and both builds; lint retains four existing warnings.
