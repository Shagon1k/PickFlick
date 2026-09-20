# Phase 5 — Clubs, Membership & Roles

This temporary delivery plan coordinates Phase 5. `ROADMAP.md` owns product scope and acceptance,
`ARCHITECTURE.md` owns trust and data boundaries, `DESIGN.md` and the canonical prototype package
own visible behavior, and GitHub Project 3 owns live issue status.

## Owning issues

| Slice | Issue | Outcome |
| --- | --- | --- |
| 5.1 | [#29 — Implement Club membership, roles, constraints, and policy projections](https://github.com/Shagon1k/PickFlick/issues/29) | Establish the private Club boundary, role invariants, temporary Free/Pro tier limits, transactional role changes, and audit records. |
| 5.2 | [#30 — Deliver no-Clubs and Create Club onboarding with Selection-scale setup](https://github.com/Shagon1k/PickFlick/issues/30) | Add transactional Club creation and the responsive first-Club experience. |
| 5.3 | [#31 — Add Club settings, lifecycle, role management, and destructive safeguards](https://github.com/Shagon1k/PickFlick/issues/31) | Expose settings, membership administration, lifecycle actions, and confirmed destructive flows. |

## Sequence and boundaries

1. Issue #29 establishes reusable Club policy and entitlement projections before a UI or mutation
   endpoint can rely on them. It also supplies the database constraints and serialized role-change
   operations that later handlers must call.
2. Issue #30 creates Clubs through that boundary and implements the no-Clubs/Create Club screens.
3. Issue #31 exposes Club and membership mutations with explicit confirmations and the same
   server-side policies.

Membership, current User status, and current App role remain authoritative database state. A
browser-supplied role, hidden control, cached projection, or App Admin role alone never grants
ordinary Club access. App Admin operational actions require their own explicit policy and audit
path; they do not inherit Club Admin permissions.

Phase 5 does not implement invitations, Sessions, live Paddle state, or the full Club Hub. A static
tier resolver maps the synthetic seeded Club to Pro and defaults every other Club to Free; Phase 20
replaces that resolver with subscription-derived state.

## Issue #29 implementation contract

- Keep historical Membership rows and enforce one active Membership per User/Club with a partial
  PostgreSQL unique index.
- Enforce at most one active Admin while allowing no active Admin.
- Keep Membership status and departure time consistent at the database boundary.
- Serialize role changes per Club, re-read the actor and target inside the transaction, and make
  retries idempotent through a caller-supplied operation identifier.
- Record role and Admin-transfer audit events in the same transaction without request bodies,
  credentials, email addresses, display names, or raw invitation data.
- Return only a current User's own Club role, lifecycle, action booleans, and bounded entitlement
  values from the policy projection. Non-members receive the generic forbidden response.
- Treat archived Clubs as read-only except for permitted ownership/lifecycle recovery actions.
- Keep API feature internals inside `IdentityModule`, `ClubsModule`, `ContactModule`, and
  `HealthModule`; `AppModule` composes them without owning feature providers. One imported
  `DatabaseModule` owns the application-scoped Prisma client and its shutdown lifecycle.

## Issue #30 implementation contract

- `GET /clubs` returns only the authenticated User's active Membership projections. `POST /clubs`
  accepts a bounded name, optional description, and one inclusive `0..N` or `1..N` Selection
  scale whose upper bound is at most 10.
- First-Club creation serializes by creator, re-reads the active User and current administered
  Clubs inside the transaction, enforces the temporary Free limit, and creates the Club plus its
  sole Admin Membership atomically.
- `/app` redirects unauthenticated requests to Login, renders the canonical no-Clubs state only
  after an authoritative empty collection response, and shows a safe recovery state when the API
  is unavailable.
- `/clubs/new` validates in the browser and server action before the API repeats validation at the
  trust boundary. Validation, conflict, offline, and service failures preserve entered values and
  use field-linked messages plus a stable live status region.
- The post-create `/app` projection confirms the Club, role, tier, lifecycle, and Selection scale.
  The full Club Hub, invitations, and Session creation remain with later issues.

## Issue #31 implementation contract

- `/clubs/[clubId]/settings` returns only an active member's private settings projection. Admins
  receive settings, role, lifecycle, avatar, and recent categorical audit controls; Moderators and
  Members receive read-only settings, disabled role controls with explanations, and leave access.
- Re-authorize current User status, active Membership, Club role, lifecycle, and plan at the API and
  database boundary. App Admin status alone grants no Club visibility or ordinary Club mutation.
- Let active Club Admins update bounded name, description, `0..N` or `1..N` Selection scale, and
  visibility/presentation settings. Free Clubs cannot enable ordinary-member Selection results.
- Store Club avatars as private PNG, JPEG, or WebP objects no larger than 512 KiB. Verify the byte
  signature, update the database reference only after storage succeeds, authorize every read, and
  retire superseded objects without logging their keys.
- Serialize role, settings, avatar-reference, archive/reactivate, leave, and empty-Club deletion
  commands per Club. Bind caller operation IDs to the actor, Club, action, and normalized request so
  an exact retry is stable and payload drift conflicts.
- Require exact `ARCHIVE` and `LEAVE` confirmations and the exact current Club name for deletion.
  Admins cannot leave their own Club. Empty-Club deletion preserves an audit tombstone and removes
  active access; Clubs with Session history cannot use this foundation.
- Keep archived Clubs readable but otherwise locked until an Admin reactivates them. Preserve the
  adminless state without silently granting recovery rights to an App Admin or another member.
- Record categorical audit evidence without request bodies, object keys, credentials, email
  addresses, display names, or raw confirmation text.

## Verification in progress

| Evidence | Command or source | Status |
| --- | --- | --- |
| Database invariants and migration upgrade | `pnpm db:check` | Passed locally against fresh isolated PostgreSQL with all eight migrations, including upgrade compatibility, Club settings defaults, Membership/Admin constraints, deletion tombstones, and audit-shape enforcement. |
| Role/action, validation, and forged-request matrix | `pnpm test` | Passed locally: all 365 tests, including focused Club management, controller, authorization HTTP, and web API coverage for Admin, Moderator, Member, App Admin, suspended, non-member, archived, unsafe file, confirmation, entitlement, and operation-ID cases. |
| Transactional settings, lifecycle, roles, and audit records | `pnpm club:check` | Passed locally against fresh isolated PostgreSQL: current-state authorization, Free visibility limits, role changes, archive/reactivate, leave, Session-history deletion refusal, exact-name empty-Club deletion, tombstones, private avatar references, safe logs, and idempotent receipts are covered. |
| Club settings responsive and interaction QA | `pnpm ui:test` | Passed locally: all 171 checks, including the 13 settings checks at S/M/L/XL and bridge widths for private denial, axe, overflow, Admin mutations, role changes, archive confirmation, Member leave, archived/read-only explanations, and eight reviewed captures. |
| Workspace quality gates | `pnpm verify` | Passed locally: lint, type-check, 365 tests, workspace-boundary validation, and all production builds. |

At the Phase 5 boundary, move durable implementation facts into canonical guidance, record phase
evidence in `ROADMAP.md`, and delete this file plus its docs-map link.
