# Phase 9 — Session creation and participant roster

Scope and phase acceptance live in [ROADMAP.md](../ROADMAP.md#phase-9--session-creation--participant-roster--in-progress).
[Project 3](https://github.com/users/Shagon1k/projects/3) owns live status.

## Delivery boundaries

- [#39](https://github.com/Shagon1k/PickFlick/issues/39) owns Session persistence, settings snapshots,
  participant/invitation storage, the blocking invariant, and roster transition inputs. Its native
  blockers #35 and #36 are closed.
- [#40](https://github.com/Shagon1k/PickFlick/issues/40) owns full-cycle/pre-selected creation,
  editing, cancellation, request validation, and screens.
- [#41](https://github.com/Shagon1k/PickFlick/issues/41) owns member-only invitation previews and
  responses, accepted-roster workflows, leave/removal, expiry, and pending invitations.

## Foundation contract

- Preserve the existing PostgreSQL blocking index: Nomination, Selection, and Watching consume the
  Club slot; Rating, Completed, and Cancelled do not.
- Copy score bounds and all five visibility/media flags into each new Session while holding the
  Club lock in its creation transaction. Session edits must preserve those fields.
- The additive migration preserves skeleton Sessions and backfills from current Club settings.
  Original creation-time settings cannot be recovered. No historical participants are invented.
  Older application images cannot insert Sessions without the new required snapshot fields;
  rollback requires a compatible application build, rather than assuming image rollback works.
- Participants keep their Membership identity and nullable attendance. Their five states separate
  invitations, acceptance, decline, leave, and removal. Composite foreign keys prevent crossing
  Club boundaries; they do not replace active-membership authorization.
- Invites store digest-only tokens, a recipient participant, same-Club inviter, expiry, revocation,
  and response state. Token generation and user-facing invite behavior remain #41 work.
- Roster writes lock the Session and increment its version transactionally. A locked roster read
  returns accepted participant identities and their count with phase and roster versions. Keep
  that lock through later serialized transitions. Follow Club → Session → participant lock order.
- #41 must propagate Club departure to Session participant state before completion checks. This
  foundation has no automatic phase transitions, invitation routes, or user-facing Session flow.

## Verification evidence

Run with Node 24.15.0 and pnpm 11.25.0 against an isolated loopback `pickflick_test` database.
The public synthetic `.env.example` supplies runtime defaults; no secret file is changed.

- All fourteen migrations apply to a fresh PostgreSQL 17.6 database; local/test seed succeeds.
- Upgrade probe: apply the first thirteen migrations, insert a legacy Watching Session with a
  stored `1..7` Club scale, then apply migration 14. Snapshot values, topic, and phase version are
  preserved; roster version starts at 1 and no participants are invented.
- `pnpm test:integration`: 98 tests across 11 files pass, including concurrent creation in all
  blocking phases, direct index enforcement without application locking, Rating coexistence,
  concurrent phase updates, snapshots, locked denominators, rollback, and invite constraints.
- `pnpm verify`: guarded security audit, lint, knip, formatting, types, 379 unit tests across
  42 files, and all builds pass. Lint reports three pre-existing frontend warnings.
- Focused Session suite after asserting unique-constraint error codes: 13 tests pass.
- Staged gitleaks scan reports no leaks.
- The sandbox blocks pnpm from writing its global SQLite store index. Verification uses a
  writable copy under `/tmp` and temporary installed-module metadata; repository configuration
  and the audit policy are unchanged.
- Schema comparison reports existing foreign-key action drift in ClubInvite and Movie
  cache/mapping tables, with no Session-table drift. Those unrelated definitions are unchanged.

No visual behavior changes; design QA and full Session journeys belong to #40/#41.

## Live Session workflows (#40)

- Reuse Session persistence, Club locks/access, catalog search, and the UI kit. No worker or
  invitation flow is added.
- Migration 15 adds canonical Movie linkage, `detailsVersion`, and Session audit references/actions.
  It preserves legacy nullable skeleton fields. Apply it before the new application build.
- A retained client v4 UUID makes unchanged create retries return the existing Session for its original
  creator; changed payloads and another creator conflict.
  Edits compare details and version; cancellation is serialized, audited once, preserves history,
  revokes pending links and releases the blocking slot.
- Creation requires date/location. Topic and notes are optional. Full-cycle starts in Nomination
  with an optional future deadline; pre-selected requires a stored Movie and starts in Watching.
- Type, selected Movie and settings snapshots cannot be edited. Details/deadline edits do not
  run phase transitions. Future transitions must increment the details version as well as the
  phase version so stale operator commands fail.
- The Hub includes every Rating Session and the twenty most recent Completed/Cancelled rows.
- Creation success links to detail and Hub. Invitation generation and roster actions belong to #41;
  complete phase-specific detail contents belong to later phases.
- Run r_53b9de1c80cc70771c0b uses the managed branch `PF-40_9-2-build-full-cycle-pre`.
  Exact-head hosted preview and owner visual acknowledgement are pending; do not mark completion.

Verification for run r_53b9de1c80cc70771c0b:

- `pnpm verify` passes: security audit under the existing approved exception, lint, knip,
  formatting, type checks, all 387 unit tests and both application builds. Lint reports three
  existing Movie UI warnings and no errors. No dependency or environment changes were made.
- All 107 database/API integration tests pass, including nine Session workflow tests covering
  operator roles, private reads, Club restrictions, concurrent creation/edits, unchanged retries,
  stale commands, cancellation, fixed settings and Hub projections.
- All fifteen migrations apply to a fresh isolated PostgreSQL database. An upgrade probe from
  migration 14 preserves a legacy pre-selected Watching Session with nullable Movie/details.
- Eight Session browser checks pass in the pinned Linux Playwright image: both modes, keyboard
  search, edit/cancel, Hub updates, failure/offline input retention, role restrictions, axe and
  overflow at 390, 768, 1024 and 1440. A final worktree run also passes all eight after result
  copy was aligned with the returned phase. Create/detail captures were inspected.
- The first full contract run passed 142 checks and found four detail-label contrast failures.
  Those four cases pass in the final eight-check Session run after the label uses `fg-secondary`.
  `pnpm test:ui:contract --last-failed` also passes all four against the final worktree build.
- The four changed Hub/overlaid-invitation baselines were inspected and regenerated in the
  pinned Linux image; invitation layout and behavior are unchanged.
- `pnpm test:ui:visual` passes all 76 comparisons in the pinned Linux image after those updates.
- Browser workflows use the mock API; integration tests exercise the real API/database. A hosted
  full-stack Session journey and owner visual acknowledgement remain unverified.

Review fix round 1 for run r_53b9de1c80cc70771c0b:

- Creation requires UUID v4, matching detail/edit/cancel routes; other UUID versions are rejected
  before persistence or audit.
- Successful creation and edits invalidate Club Hub and Session detail paths, following cancellation.
- All type aliases added by #40 follow the documented `T` prefix, including `z.infer` contracts;
  interfaces use `I`. No naming change is needed.
- `pnpm verify` passes: guarded security audit, lint (three existing warnings), knip, formatting,
  type checks, 388 unit tests and both application builds. The focused schema suite passes four tests.
- All 108 integration tests pass against a fresh migrated and seeded isolated test database,
  including UUID rejection without persistence/audit and v4 create/read/cancel.
- PR browser smoke checks: 22 pass initially; six fail while the verification build runs concurrently.
  All six pass with `pnpm test:ui:smoke --last-failed` after builds finish, including creation/edit
  followed by browser Back to the previously visited Hub. No test or implementation changes intervene.
- Verification uses Node 24.15.0, pnpm 11.25.0 and installed dependencies with automatic reinstall
  disabled because its store writes are outside the sandbox. Repository configuration is unchanged.
