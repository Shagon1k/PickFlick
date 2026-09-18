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

## Verification in progress

| Evidence | Command or source | Status |
| --- | --- | --- |
| Database invariants and migration upgrade | `pnpm db:check` | Passed locally against a fresh six-migration PostgreSQL database, including upgrade compatibility, active Membership uniqueness, single/adminless Admin states, departure consistency, and audit constraints. |
| Role/action and forged-request matrix | `pnpm test` | Passed locally: Admin, Moderator, Member, App Admin, suspended, non-member, archived, and caller-forged role cases are covered. |
| Transactional roles, idempotency, and audit records | `pnpm club:check` | Passed locally against fresh isolated PostgreSQL: current-state authorization, archived-Club denial, App Admin-only ownership transfer, suspended/anonymized transfer-target denial, mixed-case UUID retries, Free/Pro tier projection, durable no-op results, per-Club serialization, retry deduplication, categorical logs, and audit fields are covered. |
| Club onboarding unit and HTTP matrix | `pnpm test` | Passed locally: 360 tests cover authenticated collection/creation, invalid names and scale bounds, unsupported fields/media, forged and expired sessions, Free-limit conflict, preserved browser values, and response-shape validation. |
| Club onboarding responsive and interaction QA | `pnpm ui:test` | Passed locally: all 158 checks, including 14 onboarding tests at S/M/L/XL and bridge widths for axe, overflow, focus/validation, touch targets, creation, and eight reviewed captures. |
| Club creation PostgreSQL check | `pnpm club:check` | Extended with concurrent first-Club creation, sole-Admin, Free-limit, normalized values, collection, and scale assertions. Local execution is pending because this worktree has no `.env`; no secret file was created or copied. |
| Workspace quality gates | `pnpm verify` | Passed locally: lint, type-check, 360 tests, workspace-boundary validation, and all production builds. |

At the Phase 5 boundary, move durable implementation facts into canonical guidance, record phase
evidence in `ROADMAP.md`, and delete this file plus its docs-map link.
