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
