# PickFlick — Architecture

> How the system is built and where it is going. Product scope lives in [ROADMAP.md](ROADMAP.md),
> UX in [DESIGN.md](DESIGN.md), and decision rationale in the [ADR registry](_docs/decisions/README.md).
> Code and deployed configuration are the final word on current state.

| Owner     | Last reviewed | Verified against                                     |
| --------- | ------------- | ---------------------------------------------------- |
| Developer | 2026-09-26    | ADR-001–ADR-014 and branch `PF-32_verify-phases-1-5` |

**States:** `Active` — implemented and verified; `Partial` — some exists, the gap is named;
`Proposed` — accepted direction, not built. An accepted ADR does not make anything `Active`.

## 1. System overview

PickFlick coordinates private Club movie nights and keeps shared and personal film history.

- **Actors:** registered User, Club Admin/Moderator/Member, App Admin, external providers.
- **Constraints:** registered members only; one blocking Session per Club; idempotent automatic
  transitions; personal data under GDPR; a bespoke responsive UI; early-stage scale and budget.
- **Non-goals:** microservices, event sourcing, anonymous access, dedicated search, offline
  conflict resolution, multi-region runtime, AI inference.

```mermaid
flowchart LR
  User["Registered User / App Admin"] --> Frontend["frontend (Next.js)"]
  Frontend --> API["backend (NestJS)"]
  API --> DB["PostgreSQL"]
  API --> Objects["S3-compatible storage"]
  API --> OAuth["Google / Apple"]
  API --> Email["Resend"]
  API --> TMDB["TMDB (disabled until configured)"]
  API -. Proposed .-> Paddle["Paddle"]
```

| Concern    | Direction                                                                             | State                                                                                                    | ADR               |
| ---------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| Shape      | pnpm monorepo, frontend, backend, deadline worker plus a one-shot release job.        | Active                                                                                                   | ADR-014           |
| Frontend   | Next.js App Router, server components and server actions, UI kit on unstyled Mantine. | Partial — public site, login, Club onboarding, Hub overview, and settings; other product routes Proposed | ADR-013           |
| Backend    | NestJS feature modules, zod-validated REST, Better Auth database sessions.            | Partial — auth, Clubs, Contact, health; other product modules Proposed                                   | ADR-002, 010, 011 |
| Validation | zod request schemas in `@pickflick/contracts`, shared by backend and forms.           | Active                                                                                                   | ADR-012           |
| Data       | PostgreSQL through reviewed Prisma migrations; SQL constraints for invariants.        | Partial — Users, auth, Clubs, Session skeleton, cached Movies; other entities Proposed                   | ADR-003           |
| Objects    | S3-compatible storage for avatars, catalog images and exports.                        | Partial — Club avatars and catalog images                                                                | —                 |
| Background | Nomination-specific PostgreSQL jobs and a backend worker; no queue dependency.        | Active                                                                                                   | ADR-018           |
| Real-time  | SSE version signals from the API for Session progress.                                | Active                                                                                                   | —                 |
| Delivery   | Dokploy UAT and production, source-built Compose, UAT-proven SemVer promotion.        | Partial — repository-verified; live production not provisioned                                           | ADR-007, 008      |

## 2. Repository

```text
apps/
  frontend/   Next.js routes, UI kit, server-side API client
  backend/    NestJS REST API, Better Auth, feature modules, deadline worker entrypoint
packages/
  contracts/  zod request schemas and response interfaces shared by both apps
  database/   Prisma schema, migrations, client, fixtures, seed/reset CLIs
  config/     environment schema and TypeScript presets
  eslint-config/ dev-only ESLint presets and plugins
assets/brand/ production brand imagery (imported as @brand/…)
tests/        Playwright: ui-preview (local build + mock API) and uat (deployed smoke)
_docs/        guides, decisions, design prototypes
```

A package exists only while something consumes it. When a second entrypoint needs server-side
domain code, extract a focused package instead of importing one app from another.

### Backend

`AppModule` composes infrastructure and feature modules. Runtime environment, `PrismaService`, and
storage come from global modules; feature modules are non-global and export only what another
module uses. A global `AuthGuard` protects every route unless it is marked `@Public()`.

| Module                                                                 | Owns                                                                                                                                                            | State                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| auth                                                                   | Better Auth (Google, Apple behind a gate), database sessions, suspension, App roles.                                                                            | Partial — Apple not activated                                                            |
| clubs                                                                  | Club creation, Hub projection, members, settings, avatar, roles, removal, archive/reactivate, leave, delete, audit.                                             | Active                                                                                   |
| contact                                                                | `POST /contact`, rate-limited, sent directly through the email module.                                                                                          | Active                                                                                   |
| email                                                                  | Resend client; a logging stub when delivery is disabled.                                                                                                        | Active                                                                                   |
| storage                                                                | S3 put/get/delete/ping (AWS SDK).                                                                                                                               | Active                                                                                   |
| health                                                                 | `/health/live` (revision) and `/health/ready` (database, object storage).                                                                                       | Active                                                                                   |
| movies                                                                 | Configurable catalog adapters, canonical UUID/external-ID resolution, per-source cache and explicit failure states.                                             | Partial — authenticated search/details and stored catalog images; refresh worker pending |
| sessions                                                               | Live Session creation, detail, versioned edits, cancellation, member-targeted invitations, roster, nominations, personal suggestions, early closure, and audit. | Active — Nomination automatic transitions; later phases pending                          |
| Library, Achievements, Notifications, Billing, Privacy, Administration | See the Roadmap phases.                                                                                                                                         | Proposed                                                                                 |

Copy `apps/backend/src/modules/contact` for a new module; [apps/backend/AGENTS.md](apps/backend/AGENTS.md)
holds the conventions.

### Frontend

Route groups `(marketing)`, `(auth)`, `(product)`, and `(internal)` hold the routes; a route keeps
its `page.module.scss`, `actions.ts`, and `_components/`. `src/components/ui/<Name>/` is the UI kit.
Server code calls the backend only through `src/api/<area>.server.ts`, which forwards the session cookie
and client address. Forms use `@mantine/form` and call a server action that returns `TFormResult`.
[apps/frontend/AGENTS.md](apps/frontend/AGENTS.md) holds the conventions.

### How a request flows

```mermaid
sequenceDiagram
  actor Browser
  participant N as frontend (Next.js server)
  participant A as backend (NestJS)
  participant DB as PostgreSQL

  Browser->>N: Submit a form (server action)
  N->>N: Validate with the shared zod schema
  N->>A: apiRequest() with cookie and client address
  A->>A: ThrottlerGuard, then AuthGuard resolves the session
  A->>A: ZodValidationPipe validates the body again
  A->>DB: Service reads and writes through PrismaService
  A-->>N: JSON, or the error envelope
  N-->>Browser: TFormResult rendered by the form
```

Pages read data the same way: a server component calls `src/api/<area>.server.ts` during render.
The browser itself calls the backend only for sign-in (`/api/auth/*`), which the frontend proxies
to the backend. [Add a feature end to end](_docs/adding-a-feature.md) walks through each layer.

## 3. Data

| Store                 | Holds                                                                     | State                                                   |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| PostgreSQL            | All domain state, sessions, audit.                                        | Partial — local and CI; managed UAT/production Proposed |
| S3-compatible storage | Club avatars and catalog images under private opaque keys; later exports. | Partial — Club avatars and catalog images               |
| Bundled assets        | Brand imagery, versioned with the frontend build.                         | Active                                                  |

The schema (`packages/database/prisma/schema.prisma`, sixteen migrations) holds `User`,
`ProviderAccount`, `AuthSession`, `AuthVerification`, `AuthRateLimit`, `Club`, `Membership`,
`ClubAuditEvent`, `ClubInvite`, `Session`, `SessionParticipant`, `SessionInvite`, `Nomination`, `Movie`, `MovieExternalId`, `MovieSourceCache`, `MovieDetailsCache`, and `MovieSearchCache`. Database-enforced invariants:

- one active Membership per User and Club, and at most one active Admin per Club;
- at most one Nomination/Selection/Watching Session per Club;
- one Nomination per participant with same-Session linkage;
- Club score scale bounds and lifecycle consistency.
- unique invitation token digests, expiry order, and consistent response attribution.

Club invitations store only a SHA-256 digest of 32 random bytes. A raw token is returned once at
creation and sent back only in POST bodies. Admin/Moderator creation and revocation are
membership-scoped. Acceptance locks the Club row before re-checking expiry, revocation, target,
Club lifecycle, current Membership, and member limit; the Membership, audit event, and invitation
response commit together. Historical departed Memberships remain intact. Links expire after seven
days and one User can accept or decline each link. Unsafe states omit Club data; preview is available
only to authenticated Users. The invitation page and API responses are private and uncached.
Manager lists include the 20 most recent records and every live pending invitation, so older links
remain reachable for revocation. The creation action preserves its returned token if a subsequent
list refresh fails; the UI shows the link and a separate refresh warning.

Session invitations use separate digest-only tokens and target an existing Membership through a
SessionParticipant. `POST /sessions/:sessionId/invitations` returns the raw token once; preview and
response tokens travel only in POST bodies. Pending responses by invitation ID use the same locked
eligibility check. Private, uncached preview/response APIs return a single detail-free `unavailable`
state for invalid, expired, revoked, wrong-target, departed, archived, and closed access. Responses
and roster changes lock Club → Session before writing; the participant trigger increments
`rosterVersion`. Roster projections use a repeatable-read snapshot. Club departure updates open
Session participants and revokes their pending links in its membership transaction, preserving
completed history. Migration 16 adds five Session invitation/participant audit actions without
changing existing data. No worker or automatic phase transition is added.

The eleventh migration adds `MEMBERSHIP_REMOVED` to the audit enum. `POST
/clubs/:clubId/members/:membershipId/remove` validates typed `REMOVE` confirmation, locks the Club,
and re-reads actor and target roles. Admins remove non-Admins; Moderators remove Members. Self-removal
uses Leave Club. A repeated removal creates no extra event. Leave and role changes share the Club lock
with invitations and lifecycle writes; the historical Membership and Session rows remain intact.

`GET /club-invitations/pending` returns only eligible, recipient-targeted invitations in a
repeatable-read snapshot. Responses contain IDs and minimal preview fields, without tokens or digests.
`POST /club-invitations/:inviteId/respond` resolves the invitation only for its target User and shares
the token response's locked eligibility check and Membership transaction. Shareable links cannot be
listed for a recipient. Existing unsafe-state privacy rules apply to both flows.

Hub and Manage Club projections carry `IClubAccess` (`adminless`, `newWorkAllowed`, and restriction
`reasons`) and role permissions. Manage Club also identifies the caller's Membership. The access
resolver currently uses lifecycle, active administration, member count, and fixture plan limits.
Phase 20 can replace entitlement input without making browser state an authorization boundary.
`MEMBER_LIMIT` means excess roster size: history and existing participation stay available, and removal
and leaving can restore capacity. At exact capacity, the invitation API still rejects new links.
The unresolved choice among excess administered Clubs is not implemented.

Session persistence, live creation, detail, editing, and cancellation are Active. Invitations and
phase workflows remain Proposed.
Each new Session requires its own score bounds and five visibility/media flags. The internal
`snapshotSessionSettings` helper locks the Club and reads those fields; creation must call it
inside the same transaction as the Session insert. Club settings edits do not change saved Session
fields. Migration 14 backfills skeleton Sessions from current Club settings because their original
settings were not stored; it preserves phase, version, details, and history.

`SessionParticipant` references a historical Membership, with invited, accepted, declined, left,
and removed states plus nullable attendance. Composite foreign keys require the Session and
Membership to share a Club. `SessionInvite` references that participant and a same-Club inviter
Membership, stores only a unique SHA-256 digest, and checks expiry and response consistency. These
storage constraints do not authorize a request: the member-only preview, active Membership checks,
operator authorization, token generation, and invitation/leave/removal flows belong to #40/#41.

The existing partial unique index still enforces one Nomination/Selection/Watching Session per
Club; Rating is outside it. The roster trigger increments `rosterVersion` on insert, delete, or
status change and locks the parent Session in the same transaction. Attendance-only and repeated
status writes do not change the version; participant identity cannot move between Sessions or
Memberships. `readSessionRoster` takes the same lock and returns phase, phase version, roster version,
accepted participant identities, and their count. Callers must use a transaction and retain the lock
through the phase decision. Workflow writes take the Club lock before the Session lock and before
participant writes. #41 must update participant state on Club departure before checking completion;
no automatic transition or membership-departure propagation is implemented by this foundation.

`POST /clubs/:clubId/sessions` validates live modes, date, location, optional topic/notes/deadline,
and a canonical Movie UUID for pre-selected Sessions. Full-cycle starts in Nomination;
pre-selected starts in Watching. The caller supplies a v4 UUID retained across retries. A saved
`SESSION_CREATED` audit event identifies its creator; an authorized replay with unchanged details
returns the existing Session without another insert. A changed payload or different creator
conflicts. Creation locks the Club and checks current operator role, access,
the blocking slot, and Movie existence before saving settings and audit together.

`GET /sessions/:sessionId` requires current Club Membership and returns a private/no-store detail
projection. `PATCH /sessions/:sessionId` and `POST /sessions/:sessionId/cancel` lock Club then
Session and re-read Membership/access. Edits change only date, location, topic, notes, and the
nomination deadline; type, Movie and settings snapshots stay fixed. `detailsVersion` rejects stale
writes; an identical edit is a no-op. Cancellation requires typed `CANCEL`, increments both
versions, revokes pending invitations, retains history and releases the blocking slot. Repeated
cancellation creates no extra audit event. Completed and Cancelled Sessions cannot be edited.
Archived, adminless and over-limit Clubs follow the existing manage-Sessions restriction.

Migration 15 adds the nullable Movie relation, details version, and Session references/actions in
Club audit events. Legacy skeleton Sessions keep nullable details and Movies; no history is invented.
Later phase-transition implementations must increment `detailsVersion` alongside `phaseVersion`
so an operator must review the current Session before cancelling it.
Hub responses include every open Rating Session and the twenty latest Completed/Cancelled rows,
independently of recent activity. Detail and Hub reads use repeatable-read snapshots. Session creation makes no provider calls. The deadline worker below reuses the
backend package and adds no dependency or environment variable.

Remaining entities in the [Roadmap domain model](ROADMAP.md#5-domain-model) are Proposed.

## 4. Interfaces

| Interface         | Path                                         | Contract                                                                       | State                                                          |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Browser → API     | Browser → Next server (actions, pages) → API | JSON REST; zod request schemas, typed responses                                | Partial — Contact, Clubs, Hub overview                         |
| Errors            | API → callers                                | `{ error: { code, message, requestId, reason? } }`                             | Active                                                         |
| OAuth             | Browser ↔ API ↔ Google/Apple                 | Better Auth routes behind an allowlist                                         | Partial — Apple dormant                                        |
| Email             | API → Resend                                 | Plain text; environment-specific senders (ADR-009)                             | Partial — Contact only                                         |
| Club avatar       | Next → API → S3                              | Raw image ≤512 KiB, PNG/JPEG/WebP signature checked                            | Active                                                         |
| Live progress     | Frontend → API                               | Authenticated SSE versions, re-fetch after gaps                                | Active                                                         |
| Catalog providers | Backend → provider                           | PoiskKino + TheTVDB or TMDB; verified IDs, normalized metadata and safe media. | Active — disabled until configured; live provider not verified |
| Paddle            | API → provider; provider → API webhook       | Signed, idempotent webhooks                                                    | Proposed                                                       |
| CSV               | Frontend ↔ API                               | Versioned CSV schema                                                           | Proposed                                                       |

Active Session flows serialize Club → Session updates, persist submissions, evaluate completion
and transition at most once in one transaction. The deadline worker reloads and rechecks each
Session and reconciles missing overdue intent. Proposed Paddle flows verify events, store provider
IDs and apply changes idempotently; proposed account deletion anonymizes shared history and revokes
every authentication session.

## 5. Cross-cutting contracts

- **Movie catalog:** `MoviesService` accepts canonical Movie UUIDs and exposes normalized PickFlick
  DTOs. `MOVIE_PROVIDER` selects TMDB or one composite PoiskKino + TheTVDB adapter. The composite
  owns enrichment and source-cache reuse; the service consumes an aggregate cache status.
  `CATALOG_ENABLED` and `CATALOG_TIMEOUT_MS` apply to every source in the selected adapter.
  The module keeps service and persistence in its root; `providers/` contains the shared
  contract, composite, three API clients and their common HTTP transport. Source clients return
  normalized snapshots directly; only the selected adapter builds the unified provider result.
  Verified external-ID mappings
  deduplicate concurrent ingestion; title/year never establishes identity. Movie UUIDs survive
  source changes. Public links and future Session/Library relationships use those UUIDs.
  [ADR-017](_docs/decisions/README.md#adr-017--keep-movie-identity-independent-of-catalog-sources)
  defines matching, section precedence and missing English metadata behavior. Source snapshots
  retain independent locale/clock values; search cannot renew details. Projection/search keys
  include the provider configuration/merge version and locale. — Active internal service
- **Provider fallback:** callers receive `fresh`, `partial`, `stale` or `unavailable`. Source failures
  stay in provenance; a single-source NOT_FOUND preserves Movie identity and other-source data.
  Stale fallback requires opt-in, validated data within `CATALOG_STALE_HOURS` and a transient
  error. Invalid payloads, authentication, disabled configuration and removal cannot reuse stale
  source data. Every observed removal is persisted, including when all sources fail. Removal
  clocks use the individual source attempt start; timestamp ties retain the source tombstone.
  Adapters cap response bodies, reject redirects, apply timeouts and retain the longest bounded
  Retry-After cooldown. Images use allowlisted HTTPS CDN URLs; trailers remain safe YouTube links.
  Displayed detail posters are copied on API reads to private `movie-images/<sha256-of-source-url>` objects.
  Source cache data retain provider URLs; detail posters use an authenticated
  `/api/movies/images/:key` path through the existing frontend rewrite. Search returns null poster
  and backdrop fields without image I/O; details return null backdrops and cast portraits. Image
  downloads reject redirects and enforce five-second, 5 MiB and raster-signature limits. Failed
  downloads return missing media; storage failures propagate. Existing objects are reused.
  Details expose `links.imdb`, built on the backend, without external identifiers. The frontend
  detail transport allows 100 seconds for three provider requests (each configured up to 30 seconds),
  a five-second poster download and response overhead; other API calls retain ten seconds.
  Authenticated `POST /movies/search` validates the shared search schema and opts into bounded
  stale cache use. Responses are private/no-store; the existing global auth guard and a
  60-request/minute endpoint limit apply. The header calls it through a server action and
  `apiRequest`, keeping credentials and provider calls on the server. Debounced queries discard
  obsolete responses and render text through React. Links use `/movies/[movieId]` with canonical
  UUIDs. Authenticated `GET /movies/:movieId` validates the UUID and returns normalized
  detail state with backend-built outbound links; it has the same private/no-store and rate-limit
  boundary. Movie Details validates the response and opts into the existing bounded stale policy.
  A separate streamed section resolves up to six deduplicated related UUIDs through the same
  endpoint. TMDB appends similar-title identifiers; the canonical repository resolves them.
  Posters load from the authenticated stored-image endpoint without Next.js image optimization;
  trailers remain outbound links. No background refresh, migration or new configuration is added.
  Live source completeness and the ADR-016 refresh worker remain unverified.
- **Authentication:** Better Auth in the backend; identities keyed by provider subject; implicit
  linking disabled and explicit linking deferred; opaque database sessions (seven days, refreshed
  daily) in a host-only `__Host-` cookie; provider tokens never stored; suspension revokes every
  session. Next.js renders and redirects but never authorizes. See
  [Authentication and sessions](_docs/authentication.md). — Partial (Apple dormant)
- **Authorization:** deny by default. App roles User and App Admin; Club roles Admin, Moderator,
  Member re-read from the database on every command. A Club the caller cannot see answers `404`;
  App Admin does not inherit Club rights. — Active for built routes
- **Club Hub:** `GET /clubs/:clubId/hub` reads one current Membership and its Club counts and
  Sessions in a repeatable-read transaction. The API marks the response private and no-store;
  Next.js fetches it without a cache. Active Rating lookup is independent of the recent-activity
  limit. Direct visits and Club switches save the last-Club cookie only after API Hub authorization;
  a switch that loses Membership returns to `/app`. `/app` checks current Memberships before using
  the cookie. — Active for Overview. Members and Manage Club use the repeatable-read settings
  projection with the same access contract.
- **Validation:** every body, query, file, and provider payload is checked at the boundary; output
  is encoded for its context. — Active for built routes
- **Rate limits:** `@nestjs/throttler` (120/min globally, 5 per 10 minutes for Contact) keyed by the
  visitor address Express resolves by trusting two proxy hops (the Next.js rewrite and the
  Cloudflare entry); Better Auth limits its own routes to 60 a minute (10 for social sign-in). —
  Active
- **Observability:** nestjs-pino structured logs with a request ID; health endpoints. Error
  telemetry and alerts are Proposed.
- **Privacy:** minimal collection, private storage, export and deletion that anonymizes shared
  history. — Proposed
- **Security headers:** every page gets a per-request nonce CSP from `proxy.ts` (scripts only with
  the nonce, no framing, no plugins); every frontend response adds HSTS, `nosniff`, a referrer
  policy, a permissions policy, and a same-origin opener policy; the backend sends its own
  restrictive headers because Next.js does not add headers to proxied responses. See
  [ADR-015](_docs/decisions/README.md#adr-015--send-a-nonce-based-csp-and-security-headers-from-each-runtime)
  and [Security](_docs/security.md). — Active
- **Security baseline:** treat browser, provider, upload, and webhook input as untrusted; keep
  secrets server-side only and out of logs; render user text as text; hash invitation tokens; audit
  high-impact actions.

## 6. Runtime and delivery

| Environment | Topology                                                                                                                    | Data                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Local       | Frontend, backend and deadline worker run natively; PostgreSQL and MinIO in Docker.                                         | Synthetic seed; email disabled |
| CI          | Audit, lint, knip, types, unit, integration, images; PRs run UI smoke, main/manual run full contract and visual regression. | Ephemeral services             |
| UAT         | Dokploy Compose (`release`, `backend`, `worker`, `frontend`) + managed data.                                                | Synthetic; test-inbox email    |
| Production  | Same shape, pinned to a SemVer tag.                                                                                         | Real users; live providers     |

```mermaid
flowchart LR
  subgraph Dokploy["Dokploy project (one per environment), dokploy-network"]
    Release["release<br/>(migrate, seed)"] -->|completes| Backend["backend :3001"]
    Release -->|completes| Worker["deadline worker"]
    Worker --> PG
    Backend -->|healthy| Frontend["frontend :3000"]
    PG[("Managed PostgreSQL")]
  end
  Internet["Cloudflare → Traefik"] --> Frontend
  Frontend -->|"/api/* rewrite"| Backend
  Release --> PG
  Backend --> PG
  Backend --> S3[("S3 / MinIO")]
  Backend --> Resend["Resend"]
```

- **Configuration:** one zod schema in `@pickflick/config`; startup fails on invalid values.
  [\_docs/environment.md](_docs/environment.md) lists every variable. Secrets live only in the
  platform's secret store.

```mermaid
flowchart LR
  Push["Push to main"] --> CI["ci.yml<br/>Delivery gate"]
  CI -->|success| UAT["deploy-uat.yml<br/>job UAT E2E"]
  UAT --> D1["Dokploy deploys the SHA"] --> H1["/health/live reports the SHA,<br/>ready is up"] --> Smoke["Playwright smoke"]
  Manual["Run Promote to Production"] --> V["Validate: version,<br/>UAT E2E passed for the SHA"]
  V -->|"PRODUCTION_DEPLOY_ENABLED = true<br/>and approval"| P["Tag, pin Dokploy,<br/>deploy, check health"]
  V -->|guard off| Stop["Stop: nothing changes"]
```

- **Deployment:** after CI passes on `main`, including Linux visual regression,
  `deploy-uat.yml` deploys that exact revision, waits
  until `/health/live` reports it with every dependency ready, and runs the Playwright UAT smoke.
  `promote-production.yml` requires a successful `UAT E2E` check for the release revision, tags it,
  pins Dokploy to the tag, and deploys — only when `PRODUCTION_DEPLOY_ENABLED=true`. See the
  [UAT](_docs/uat-operations.md) and [production](_docs/production-operations.md) guides.
- **Migrations:** reviewed Prisma migrations applied by the release job before the backend and worker start.
- **Rollback:** redeploy a previous tag when the schema is compatible; otherwise fix forward.
- **Backups and restore drills:** Proposed, required before launch.

## 7. Decisions

| ADR | Direction                                                        |
| --- | ---------------------------------------------------------------- |
| 002 | Authentication and sessions live at the API boundary.            |
| 003 | PostgreSQL with reviewed Prisma migrations.                      |
| 007 | Proportional Dokploy baseline with source-built Compose.         |
| 008 | Promote UAT-proven revisions to production as SemVer tags.       |
| 009 | One public contact address; environment-specific Resend senders. |
| 010 | Better Auth inside the API.                                      |
| 011 | Feature modules; global infrastructure modules.                  |
| 012 | Shared zod schemas at every boundary.                            |
| 013 | UI kit in the frontend on unstyled Mantine.                      |
| 014 | Two entrypoints until the first background job.                  |
| 018 | PostgreSQL intent and worker for Nomination deadlines.           |

Superseded: ADR-001, 004, 005, 006. Update this document whenever a deployable, module, data owner,
interface, integration, environment, or guarantee changes.

### Nomination submissions and projection

Active Nomination storage links a canonical Movie to one SessionParticipant in the same Session.
A compound unique key enforces one submission per participant; a composite foreign key prevents
cross-Session linkage. Submission and operator early closure reuse Club → Session locking. Closure
updates phase/details versions and records `SESSION_NOMINATION_CLOSED` atomically.

`GET /sessions/:sessionId` includes nested nomination data while Nomination is open. Session
`version` represents `detailsVersion`; `phaseVersion` is a separate concurrency token.
`POST /sessions/:sessionId/nominations` submits the caller's nomination;
`POST /sessions/:sessionId/nominations/close` accepts `phaseVersion` and `CLOSE`
confirmation. Responses are private and uncached. The server filters hidden films and author names
using the Session snapshot, exposes aggregate accepted/nominated counts, and derives up to twelve
personal suggestions from earlier same-Club losing nominations with a resolved winner. Movie titles
and years come from the Movies boundary's cache-only summaries. Validated details and source caches
take precedence; validated search caches supply metadata for Movies nominated without opening their
details. Unavailable metadata is explicit.
Nomination mutations return no projection. Refresh and successful mutations revalidate the Session
page, which fetches the authoritative Session detail once; the client keeps no projection copy.
No saved-film entity or provider request on submission is added. Completion on submission and live
progress version signals are Active under #44.

### Nomination deadlines

Active deadline automation follows [ADR-018](_docs/decisions/README.md#adr-018--persist-nomination-deadline-jobs-in-postgresql).
Migration 18 adds Session `deadlineVersion`, durable `NominationDeadlineJob` scheduling intent,
`NominationDeadlineDecision` audit records without a human actor, and recipient-specific
`NominationDeadlineNotification` intent. Notification delivery remains Proposed for the later
notification phase; these rows do not send messages.

Creation and deadline edits schedule intent in their Session transaction. Edits increment only
`deadlineVersion` when the deadline changes; clearing, cancellation and manual closure finish pending
intent. The worker selects candidates without locking jobs, then locks Club → Session → job and
rechecks phase, lifecycle, phase version, deadline version and timestamp. Zero accepted nominations
leave Nomination open and retain one operator-alert decision per deadline version. One selects that
Movie for Watching; two or more nominations, including repeated Movies, open Selection. Transitions
clear the deadline and increment phase/details/deadline versions. Decision audit, recipient intent
and job completion commit atomically with the transition.

`apps/backend/src/deadline-worker.ts` runs independently of the API. It reconciles missing overdue
intent on startup and every five seconds, preserving handled empty deadlines, then executes pending
due jobs through the same transaction. Archived Clubs pause until reactivation. Structured events
record repairs, outcomes, stale work, safe failure reasons and lateness without user text or database
error details. Pending work retries on the next poll after failure or process restart. SIGTERM/SIGINT
stop accepting candidates, finish the current transaction and disconnect Prisma. A private heartbeat
file marks completed cycles; Compose checks its freshness. No Redis, queue library or generic job
framework is introduced. Production activation remains unauthorized.

### Automatic Nomination completion and live progress

Migration 19 adds Session `progressVersion` and `SessionProgressEvent`, a Session-specific
transactional outbox keyed by `(sessionId, version)`. Nomination, roster, details, cancellation,
manual closure and deadline transitions persist their new version with an event. Events retain
phase, phase/details/roster versions, accepted/nominated counts and accepted Membership recipients
for later notification work. `AUTOMATIC` records the machine decision without a human actor.
Notification delivery and retention policy remain later phases; no dispatcher or message broker is
introduced. Existing rows start at version 1 without invented events or retrospective transitions.

Submission and roster changes evaluate accepted participants under Club → Session locks. Positive
N/N completion selects a sole Movie for Watching or opens Selection with two or more nominations;
repeated Movies count separately. Session/Club departure and removal update participation first.
Archived Clubs publish progress without advancing; reactivation checks the current roster.
The shared transition clears deadline intent and increments phase/details versions exactly once.
Outbox failure rolls back the state change and submission. Deadline decision/recipient records remain
independent, preserving ADR-018's empty-deadline operator intent.

Session detail and roster expose their snapshot's `progressVersion` separately from editing,
phase and roster concurrency tokens.
`GET /sessions/:sessionId/progress` returns only `{ version }` for fallback checks.
`GET /sessions/:sessionId/progress/events` sends private, uncached same-origin SSE with current
version and event ID on connection and every five seconds. Current snapshots heal gaps and old
`Last-Event-ID` values; they do not replay private projections. Each heartbeat resolves the current
API-owned authentication session and active Club Membership. Access loss terminates the stream;
other failures log a fixed safe message and permit reconnect. Disconnect unsubscribes the timer; API shutdown finishes active streams.

The frontend compares signals to the older of the rendered Session detail and roster progress versions and
refreshes authoritative server components after newer versions. Recovery stays mounted when either
page read fails transiently; without a rendered version, an unchanged signal also retries the page.
An unavailable stream shows feedback and polls the snapshot every
fifteen seconds; focus and online recovery also check it. Manual refresh remains available. The
client owns no film/progress projection copy. No dependencies, runtime variables or topology changes
are required. Apply migration 19 before releasing the API and worker images.
