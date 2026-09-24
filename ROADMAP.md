# PickFlick — Web App Roadmap

> Living product and delivery contract for the greenfield PickFlick application.
> Product behavior follows the approved design package when it conflicts with the retired blueprint,
> except where later developer decisions are recorded here.

| Related artifact | Project path |
| --- | --- |
| Design reference | [DESIGN.md](DESIGN.md) |
| Architecture reference | [ARCHITECTURE.md](ARCHITECTURE.md) |
| ADR registry | [_docs/decisions/README.md](_docs/decisions/README.md) |
| Canonical prototypes | [_docs/design/prototypes/index.html](_docs/design/prototypes/index.html) |
| Actionable delivery tracker | [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) |

GitHub Issues in Project 3 are the canonical source for actionable active and deferred delivery
work. This Roadmap remains the product/MVP/phase contract and phase-level acceptance record; it is
not a duplicate task inbox.

## 1. Project Contract

| Field | Value |
| --- | --- |
| Product | A private, registered-user web app that helps film clubs nominate, select, watch, rate, and remember films together. |
| Primary users | Friends and small film clubs; Club Admins and Moderators coordinating sessions; App Admins operating PickFlick. |
| Core outcome | A club can move from “what should we watch?” to a shared, durable film-night memory without chat-thread chaos or spreadsheet bookkeeping. |
| MVP proof | Real clubs repeatedly complete the session lifecycle, return to their shared and personal histories, and understand the Free/Pro value boundary. |
| Non-goals | Anonymous participation, session-only guests, native mobile apps, offline writes, public social profiles, AI analysis, and enterprise organization management. |

## 2. Product Shape

### Core Loop

```text
Create or join a Club -> Create a Session -> Nominate -> Select -> Watch -> Rate -> Remember
```

Alternative entries:

```text
Pre-selected film -> Watch -> Rate -> Remember
Past screening -> Record attendees, optional nominations/votes, and ratings -> Remember
Discover a film -> Rate or add to Watchlist -> My Library
```

### Key Differentiators

- The full club ritual lives in one coherent lifecycle instead of being split across chat, polls, notes, and spreadsheets.
- Configurable scored selection and deterministic tie-breaking produce a result without social negotiation deadlock.
- Club history and personal film memory coexist without collapsing historical session ratings into an editable personal rating.
- Club character matters: Projector Noir visuals, the panda mascot, achievements, leaderboards, and screening-language copy make administration feel ceremonial rather than bureaucratic.
- Members can join unlimited Clubs for free; the organizer’s plan controls each administered Club’s limits.

### Brand & UX Direction

| Area | Decision |
| --- | --- |
| Visual identity | “Projector Noir”: deep monochrome surfaces, restrained ivory and connected gold, editorial serif display type, utilitarian sans body type, mono metadata, and cinematic panda illustrations. |
| Voice & tone | Warm, concise, film-literate, and lightly theatrical. Forms, errors, privacy, billing, and destructive actions stay plain and unambiguous. |
| UX principle | Preserve context through the whole movie-night journey; make the current Club, Session, phase, progress, next action, and recovery path obvious. |

## 3. MVP Scope

Every canonical product surface in the design package is part of MVP. “Coming soon” items inside those surfaces remain out when listed below.

### IN

#### Public, authentication, and setup

- Responsive landing, pricing, contact, legal-entry, sign-in, Club invitation, and system error experiences.
- Registered accounts only, with Google OAuth active. The reviewed Apple implementation remains
  dormant until the owner approves Apple Developer Program membership and sandbox/UAT activation;
  no anonymous or password-based use is in MVP.
- Auth return-to-intended-destination, including Club invitation acceptance.
- First-run no-Clubs state, Create Club, Join Club, and safe error/recovery states.

#### Clubs and roles

- Create, edit, switch, archive/reactivate, and delete Clubs.
- Club description/avatar, member list, invite link, activity, statistics, ratings leaderboard, achievements, and session history.
- Club-level roles: Admin, Moderator, and Member.
- App-level roles: App Admin and User only.
- Club moderation, ownership transfer through App Admin operations, and explicit adminless-Club handling.

#### Session lifecycle

- Full-cycle, pre-selected, and past-session creation modes.
- Member-only Session invitations and participation roster.
- Nomination search through TMDB, one nomination per participant, and reusable Club bench items.
- Configurable scored voting range: lower bound 0 or 1; upper bound from 1 through 10; upper bound must exceed the lower bound.
- Deterministic tie-breaking and configurable result visibility according to plan and Club settings.
- Optional nomination deadline and automatic phase transitions defined in Section 5.
- Watching, Rating, Completed, early admin-controlled phase closure, participant removal, Session cancellation, and Session detail editing.
- Multiple incomplete Rating-phase Sessions without blocking a new Session; no parallel Nomination, Selection, or Watching Sessions in one Club.
- Past-session attendee selection, optional attendee ratings, and optional reconstruction of nominations and votes.

#### Personal film memory

- Global film search and TMDB-backed Movie Details.
- One editable personal rating per user/movie.
- Immutable completed Session ratings retained separately for historical accuracy.
- Watchlist with Low, Medium, and High priority.
- My Library ratings, watchlist, aggregate statistics, search/filtering, and personal achievements.
- Club aggregate statistics, leaderboard, and Club achievements.
- Provider-backed “You may also like” recommendations; personalized AI recommendations are not MVP.

#### Settings, notifications, privacy, billing, and operations

- Profile/avatar, language-ready settings, notification preferences, subscription/usage/billing history, billing portal, privacy, data import/export, GDPR archive, and account deletion.
- In-app and email notifications for lifecycle, inactivity, and billing events.
- Free and monthly Pro plan, Paddle checkout/portal/webhooks, downgrade/read-only behavior, and provider-managed recurring billing anchored to the initial payment date.
- App Admin overview, operational activity, user suspension/reinstatement, Club ownership transfer/deletion, registration controls, maintenance mode, TMDB refresh configuration, and audit-retention configuration.
- Installable, online-first PWA shell; network-required mutations and explicit offline failure messaging.
- Responsive S/M/L/XL behavior and accessible keyboard, touch, focus, validation, dialog, and reduced-motion contracts.

### OUT

| Item | Why out | Target |
| --- | --- | --- |
| AI analysis of watch history | Requires a stable history corpus, privacy design, evaluation, and cost controls. | Post-MVP |
| Personalized AI film recommendations | TMDB/provider-related titles cover the MVP surface without an inference pipeline. | Post-MVP |
| AI-enhanced Club analytics | Extended deterministic analytics ship first. | Post-MVP |
| Club ratings CSV export | Marked “Coming soon” in pricing; personal rating CSV remains MVP. | Post-MVP |
| Offline nominations, votes, ratings, or queued mutations | Conflict resolution and stale phase handling would add disproportionate risk. | Post-MVP |
| Web push notifications | In-app and email channels cover MVP. | Post-MVP |
| Annual billing | Initial commercial offer is €5 monthly Pro only. | Post-MVP |
| Russian or other UI locales | Build localization-ready now; ship English first. | Post-MVP |
| Session-only guests | Session access requires both registration and Club membership. | Not planned |
| App-wide Support role | App authorization has only User and App Admin. | Not planned |

## 4. Baseline Web App Considerations

| Status | Meaning |
| --- | --- |
| `Needs decision` | A safe answer is still required; the Decision Log names its trigger. |
| `Planned` | Direction is chosen but not implemented. |
| `Covered` | Implemented and verified with linked evidence. |
| `Deferred` | Intentionally postponed with a revisit trigger. |
| `Not applicable` | Retained to show why the concern does not apply. |

| Area | Default question | Status | Decision / note |
| --- | --- | --- | --- |
| Infrastructure & Foundation | How are repo layout, local dev, scripts, CI, containers, and base architecture handled? | Planned | pnpm TypeScript monorepo with web, API, worker, shared contracts, PostgreSQL, Redis, and containerized delivery; final choices are approved in Phase 1. |
| Users & Authentication | Does the app need users, roles, sessions, OAuth, permissions, or anonymous mode? | Planned | Registered OAuth users only; Google is active and Apple is retained behind a default-off owner-controlled provisioning gate. App Admin/User globally; Admin/Moderator/Member per Club; server-side authorization is mandatory. |
| Design System | How do UI primitives, layout, styling, tokens, and component rules stay consistent? | Planned | Canonical Projector Noir rules and prototypes live under `_docs/design/prototypes`; production tokens/components are established in Phase 2. |
| Localization | Is the product single-language, multilingual now, or multilingual-ready later? | Deferred | English MVP with externalized copy, locale-safe date/number formatting, and layout tolerance; add Russian when localization becomes scheduled. |
| Analytics & Monitoring | How will we know usage, errors, latency, job health, and outages? | Planned | Structured logs, error/performance monitoring, health checks, job metrics, and first-party aggregate product metrics; no undisclosed behavioral tracker. |
| SEO | Does the app have public/indexable pages, metadata, sitemap, robots, and share previews? | Planned | Public marketing/pricing/contact/legal pages are indexable with metadata and social previews; authenticated and invite-token routes are noindex. |
| Security | What are the auth, validation, secrets, rate limits, headers, abuse, and data-protection rules? | Planned | Deny-by-default authorization, boundary validation, output encoding, secure cookies/tokens, CSRF strategy, rate limits, verified webhooks, encrypted transport, and secret isolation. |
| Testing & Quality Gates | How will behavior be verified? | Planned | Unit/domain, API integration, database, worker/job, E2E critical-flow, accessibility, responsive visual, and provider-contract checks run through CI gates. |
| Data & Privacy | What personal data is stored, exported, deleted, retained, and shared? | Planned | Data inventory, personal CSV and GDPR archive, account deletion/anonymization, shared-history preservation, audit retention, and provider disclosures are launch requirements. |
| Mobile Support | Is mobile first-class? | Planned | Mobile is first-class, recomposed rather than merely shrunk, with fixed bottom navigation and 44px minimum touch targets. |
| PWA / installability | Does the app need offline support, installability, push, or an app shell? | Planned | Installable online-first PWA; cached shell/read-only fallback may be used, but mutations require a live connection; push deferred. |
| Environments & Production Deploy | How are environments, migrations, deploys, rollback, and smoke checks handled? | Planned | Local and CI/test profiles plus `https://uat.pick-flick.app` and `https://pick-flick.app`; Phase 1 establishes the shared Dokploy/Cloudflare deployment baseline, automatic UAT delivery, and a disabled manual production-promotion path. Forward migrations, backups, rollback, and smoke checks remain required. |

### Pre-MVP Production Readiness

These decisions must be resolved before the first production MVP launch. A `Deferred` item needs
an owner and revisit trigger; it cannot bypass a launch-critical risk.

| Topic | Required decision and evidence | Status | Owner | Current planning direction / revisit trigger |
| --- | --- | --- | --- | --- |
| Deploy ownership | Name one release owner and rollback authority; record the exact approved revision, readiness and smoke evidence, and tested rollback path. | Needs decision | Release owner — to be assigned | Phase 23 prepares the release candidate and runbooks; Phase 25 records the deployed revision and production evidence. Assign before Phase 23 release rehearsal. |
| Data durability | Decide backup destination and retention; demonstrate restore; separately decide the response to regional or hosting-account loss. | Needs decision | Infrastructure owner — to be assigned | PostgreSQL and durable avatars require backups; Redis is not a domain source of truth. Align retention with the Phase 19 legal/privacy decision and complete the restore/disaster-recovery drill in Phase 23. |
| Edge reliability | Verify client identity behind the chosen proxy, abuse limits, graceful connection/workload drain, and a real UAT drill. | Needs decision | Infrastructure owner — to be assigned | Reverse proxy and Dokploy are Proposed. Decide their concrete behavior before Phase 23; verify it again with production-like UAT before the Go decision. |
| Public surface | Validate the confirmed canonical host, SEO, PWA, and social/OG assets in production; account for external crawler cache refresh. | Planned | Product owner + developer | Production is `https://pick-flick.app`; UAT is `https://uat.pick-flick.app`. Public metadata is implemented in Phase 3 and completed in Phase 23; validate deployed canonical/robots/sitemap/preview behavior and document cache-refresh evidence before launch. |
| Compliance boundary | Separate technically shipped behavior from required external legal action, then explicitly decide `Launch gate` or `Post-launch follow-up` for each unresolved item. | Needs decision | Product owner + legal/privacy reviewer | Privacy, retention, billing, provider disclosure, and public legal copy require review. Resolve the disposition before Phase 23 exits; no safety, privacy, or billing risk may be deferred through Phase 24. |

## 5. Business, Product & Monetization Rules

### Identity and access

| Rule | Rationale | Enforcement |
| --- | --- | --- |
| Every participant has a registered PickFlick account. | Personal history, privacy rights, invitations, and phase denominators require a durable identity. | OAuth gate plus API authorization. |
| App roles are only User and App Admin. | Avoid an unsupported global Support permission model. | Database constraint and server policy. |
| Each Club has at most one Admin, may have multiple Moderators, and may temporarily have no Admin. | Separates ownership/billing from operational help and supports rare account-deletion cases. | Membership-role constraints and audited transitions. |
| Admin owns billing, ownership, Club deletion, role management, and all Moderator capabilities. | High-impact actions remain with the owner. | Server authorization; never UI-only. |
| Moderator may create/edit/cancel/advance Sessions, invite or remove Session participants, and log past Sessions. | Lets trusted members run movie nights without financial or ownership authority. | Server authorization. |
| Member may accept eligible invitations, participate, view allowed results/history, manage personal data, and leave a Session or Club. | Covers the normal participant journey. | Server authorization and visibility policy. |
| A Session invite reveals no Session details to a non-member. | Prevents accidental disclosure and enforces the Club boundary. | Generic forbidden state with a hint to join the Club first. |
| Accepting a Session invite never creates membership. | Membership requires the separate Club invitation flow. | Invite-type validation and transaction boundary. |

### Club and Session invariants

| Rule | Rationale | Enforcement |
| --- | --- | --- |
| A Club may have at most one blocking Session in Nomination, Selection, or Watching. | Members should focus on one active movie-night decision. | Database-level invariant plus transactional state change. |
| Any number of Sessions may remain in Rating while a new blocking Session runs. | Slow or unwilling raters must not block the next movie night. | Rating is explicitly non-blocking. |
| Admin or Moderator may close Rating before all responses arrive. | Participation is voluntary and waiting indefinitely is not useful. | Confirmed phase action; received ratings remain immutable history. |
| One participant may submit one nomination in a full-cycle Session. | Keeps influence balanced. | Unique Session/participant nomination constraint. |
| A submitted Selection ballot is immutable in MVP. | Preserves trust and makes automatic completion deterministic. | Unique ballot plus closed submission state. |
| Session ratings are historical records; personal movie ratings are editable summaries. | Club history must not rewrite when a person changes their mind later. | Separate entities and aggregates. |
| Past Sessions may record partial historical evidence. | Old movie nights rarely have complete data. | Optional nominations, ballots, and attendee ratings with provenance. |

### Automatic phase transitions

The eligible denominator `N` is the current Session participant roster for that phase. Removing or leaving a Session updates the roster before completion is evaluated. Every transition is idempotent and serialized to prevent two clients or a deadline job from advancing twice.

| Current phase | Automatic trigger | Result |
| --- | --- | --- |
| Nomination | All `N` participants have nominated and at least two nominations exist. | Open Selection and notify participants. |
| Nomination | All `N` participants have nominated and exactly one nomination exists. | Select the sole film and advance to Watching. |
| Nomination | Optional deadline expires with at least two nominations. | Close nominations, open Selection, and notify participants. |
| Nomination | Optional deadline expires with exactly one nomination. | Select the sole film and advance to Watching. |
| Nomination | Optional deadline expires with zero nominations. | Stay in Nomination and notify the Admin/Moderators; submissions remain open until manual action or a new deadline. |
| Selection | All `N` participants have submitted ballots. | Compute the winner, advance to Watching, and notify participants. |
| Rating | All `N` participants have rated. | Complete the Session and publish allowed results. |

Otherwise, only the Club Admin or a Moderator advances a phase with explicit controls. Watching always moves to Rating manually because attendance, the real screening, and timing cannot be inferred from page activity. Manual early closure must use the same deterministic result rules and may not advance Nomination with zero films.

### Selection and result rules

- Each Club chooses the upper bound N (at most 10) of an inclusive `0..N` score scale. The data model and API still accept a stored `1` start; existing Clubs keep theirs, and the product UI no longer offers that choice (see the Decision Log).
- Every Selection participant scores every nomination before submitting.
- Winner computation uses total score first, then the deterministic tie-break sequence retained from the product blueprint: more maximum scores, more distinct supporting voters, earlier nomination, stable movie-provider ID, then stable nomination ID.
- Free Clubs keep vote results hidden from ordinary members; Pro Club Admins configure post-close visibility. App Admins retain audited operational access only when required.
- “Show who nominated,” pre-submission nomination visibility, post-close vote visibility, and post-close rating visibility are independent Club policies where the plan permits configuration.
- Rating uses a fixed 1–10 scale and may include an optional comment.

### Pricing / Limits

| Feature / limit | Free — Screening Room | Pro — Director’s Cut |
| --- | --- | --- |
| Price | €0 | €5 per recurring monthly billing period |
| Admin Clubs per subscriber | 1 | 5 |
| Clubs joined as Member/Moderator | Unlimited | Unlimited |
| Members per Club | 8 | 16 |
| Blocking Sessions per Club | 1 | 1 |
| Open Rating Sessions per Club | Unlimited | Unlimited |
| Session history | Unlimited | Unlimited |
| Club customization | Included | Included |
| Vote-result visibility | Always hidden from ordinary members | Admin-configurable |
| Inactivity grace | 90 days | 180 days |
| Analytics | Basic counters | Extended deterministic analytics |

- The monthly billing anchor is the first successful payment date and is managed by Paddle; it is not a calendar-month subscription.
- Pro cancellation or downgrade takes effect at the end of the paid billing period.
- Over-limit Clubs and accounts retain data but become read-only for new rounds/invites until within Free limits. The exact Club-selection UX on downgrade remains in the Decision Log.
- Inactive Clubs become draft/archived after their plan’s grace period, with Admin notification. They are not automatically deleted and may be reactivated.
- Members never need Pro solely to participate; the Club Admin’s plan determines Club limits.

### Account deletion and shared history

- Delete the user’s private profile data and cancel their active subscription through an auditable workflow.
- Preserve shared Club/Session history by anonymizing the departing user’s attribution rather than deleting nominations, votes, ratings, or Sessions required by other members’ history.
- Remove memberships and personal Library/Watchlist data according to the approved retention policy.
- If the deleted user was Club Admin and no transfer occurred, leave the Club adminless, notify all remaining members, and make ownership-dependent actions unavailable until a later recovery policy is chosen.
- Exact legal wording and deletion timing require pre-launch review; prototype copy is not a legal commitment.

## 6. Glossary

| Term | Meaning | Canonical usage |
| --- | --- | --- |
| PickFlick | The product and application. | `PickFlick` |
| User | Any registered account; may also have app-level or Club-level roles. | `User` |
| App Admin | A User authorized to operate the PickFlick service globally. | `APP_ADMIN` |
| Club | A private group that organizes and remembers screenings. “Group” is retired product terminology. | `Club` |
| Club Admin | The Club owner and subscription/role authority. | `ADMIN` membership role |
| Moderator | A Club member allowed to operate Sessions but not ownership or billing. | `MODERATOR` membership role |
| Member | A normal Club participant. | `MEMBER` membership role |
| Session | One planned or historical screening and its lifecycle data. | `Session` |
| Blocking Session | A Session in Nomination, Selection, or Watching; only one per Club. | Derived lifecycle classification |
| Nomination | One participant’s proposed film for a full-cycle Session. | `Nomination` |
| Selection | The scored voting phase used to choose among nominations. “Voting” may appear as explanatory copy but is not the canonical phase name. | `SELECTION` |
| Ballot | One participant’s immutable set of scores for every nomination. | `SelectionBallot` |
| Session Rating | A participant’s historical 1–10 response for one screening. | `SessionRating` |
| Personal Rating | A user’s current editable rating for a Movie, independent from historical Session records. | `PersonalMovieRating` |
| Bench | Club-specific films saved for quick future nomination. | `ClubBenchItem` |
| Watchlist | A user’s personal saved films with viewing priority. | `WatchlistItem` |
| Rating phase | Non-blocking period after watching while attendees submit ratings. | `RATING` |
| Completed | Closed Session whose visible results and history are stable. | `COMPLETED` |

## 7. Domain Model & State

### Domain Model

| Entity | Key fields | Notes |
| --- | --- | --- |
| User | profile, email, app role, status, locale | Registered identity; suspended users are signed out and denied access. |
| OAuthAccount | provider, provider subject, User | Google and Apple identities; provider subject is unique. |
| Club | Admin, name, description, avatar, plan-derived limits, visibility settings, lifecycle | May temporarily be adminless; shared history survives personal account deletion. |
| Membership | Club, User, role, status, joined/left timestamps | Unique active membership per User/Club; roles Admin, Moderator, Member. |
| ClubInvite | token digest, Club, inviter, expiry, state | May be inspected only within the privacy-safe invitation contract. |
| Session | Club, type, phase, date, location, topic, notes, selected Movie, deadline, closure metadata | Type is Full Cycle, Pre-selected, or Past; phase controls blocking status. |
| SessionParticipant | Session, Membership, invitation/attendance state | Owns phase denominator and historical attendance snapshot. |
| SessionInvite | token digest, Session, invited Membership, expiry, state | Valid only for an existing Club member; non-members receive no details. |
| Movie | TMDB ID, title, release data, credits, media metadata, refresh state | Cached provider record; TMDB ID is canonical external identity. |
| ClubBenchItem | Club, Movie, creator, created time | Reusable future nomination shortcut. |
| Nomination | Session, participant, Movie, submitted time, provenance | One per participant; imported past data is marked as such. |
| SelectionBallot | Session, participant, submitted time | Immutable after submission. |
| SelectionScore | Ballot, Nomination, score | Score validated against the Club’s snapshot scale. |
| SessionRating | Session, participant, score, comment, submitted time | Historical value; immutable after Session completion. |
| PersonalMovieRating | User, Movie, score, updated time, source | Editable current rating; Session submission may update it without rewriting history. |
| WatchlistItem | User, Movie, priority, timestamps | Priority is Low, Medium, or High. |
| AchievementDefinition | scope, key, rule/version, presentation | Personal or Club achievement; version rules rather than mutating earned history silently. |
| AchievementAward | definition, User or Club, progress, awarded time | Supports unlocked, in-progress, and not-started views. |
| Notification | recipient, type, payload reference, read/delivery state | In-app source of truth; payload uses safe entity references. |
| NotificationPreference | User, event type, in-app/email flags | Billing/service announcements may have mandatory policy exceptions. |
| Subscription | User, Paddle IDs, plan, status, billing period | Club entitlements derive from the Admin’s active plan. |
| BillingEvent | provider event ID, type, processing state | Idempotent webhook record and audit trail. |
| AdminAuditEvent | actor, action, target, safe metadata, timestamp | Append-oriented sensitive operations log with configurable retention. |
| ContactMessage | optional identity fields, message, handling state | Message is required and limited to 500 characters. |
| DataExportJob | User, export type, status, expiry | Produces personal CSV or GDPR archive without blocking requests. |

### Session State Machine

```mermaid
stateDiagram-v2
  [*] --> NOMINATION: Full-cycle Session
  [*] --> WATCHING: Pre-selected Session
  [*] --> COMPLETED: Past Session import
  NOMINATION --> SELECTION: 2+ nominations and automatic/manual close
  NOMINATION --> WATCHING: Exactly 1 nomination selected
  SELECTION --> WATCHING: Automatic or manual close
  WATCHING --> RATING: Admin/Moderator starts rating
  RATING --> COMPLETED: All rated or Admin/Moderator finishes
  NOMINATION --> CANCELLED
  SELECTION --> CANCELLED
  WATCHING --> CANCELLED
  RATING --> CANCELLED
```

`RATING` and `COMPLETED` do not consume the Club’s single blocking-Session slot. `CANCELLED` remains auditable but is excluded from normal history unless product copy explicitly exposes it.

## 8. Navigation & Route Map

### Navigation Decisions

| Surface | Decision |
| --- | --- |
| Public header | Product mark, How it works and Features landing anchors, Pricing, and a Go to App entry. Below 821px the header keeps only Pricing and Go to App; public pages have no bottom menu. Contact and legal links live in the footer. |
| Authenticated desktop | Global film search, notifications, account menu, Club switcher, and context tabs/sidebar. |
| Authenticated mobile | Recomposition with fixed bottom navigation for Hub, My Library, Alerts, and Settings; local film-strip menus expose subviews. App Admins reach the Admin Panel from the Settings strip. |
| App Admin | Separate protected administration shell accessible only to App Admin. |
| Post-login routing | Return to a valid pending invite when present; otherwise open last-used Club, or the no-Clubs onboarding state. |

### Route Map

| Route | Description |
| --- | --- |
| `/` | Public landing page. |
| `/pricing` | Free/Pro comparison and billing entry. |
| `/contact` | Public contact form. |
| `/login` | Available provider sign-in and legal links; authenticated Users continue to `/app`, while Google is visible and dormant Apple is omitted. |
| `/legal/privacy` | Launch-required privacy notice; final copy requires review. |
| `/legal/terms` | Launch-required terms; final copy requires review. |
| `/invite/club/[token]` | Club invitation preview, auth continuation, accept/decline, expired state. |
| `/invite/session/[token]` | Member-only Session invitation; generic error for non-members or invalid access. |
| `/app` | Authenticated landing; last Club Hub or no-Clubs state. |
| `/clubs/new` | Create Club and configure selection scale. |
| `/clubs/[clubId]` | Club Hub with Overview, Sessions, Ratings, Members, Achievements, and Manage Club views. |
| `/clubs/[clubId]/sessions/new` | Create full-cycle or pre-selected Session. |
| `/clubs/[clubId]/sessions/past/new` | Log a past screening. |
| `/sessions/[sessionId]` | Phase-aware Session detail for Nomination, Selection, Watching, Rating, or Completed. |
| `/library` | Personal ratings, Watchlist, statistics, and achievements. |
| `/movies/[tmdbId]` | TMDB-backed Movie Details, personal rating, Watchlist priority, and related films. |
| `/settings` | Profile, notifications, subscription, Privacy & data, and import/export sections. Privacy & data holds the personal-data summary and rights actions (personal CSV export, GDPR archive, account deletion) and links to `/legal/privacy`; it does not duplicate policy text. |
| `/admin` | App Admin overview, Users, Clubs, and application settings. |
| `not-found` | Branded 404 state with safe navigation. |
| `error` | Branded application error state with retry and Hub recovery. |

## 9. Architecture Decisions

The developer accepted the foundational direction in ADR-001 through ADR-006 on 2026-09-05,
the proportional deployment baseline in ADR-007 on 2026-09-07, the source-built SemVer
production-promotion amendment in ADR-008 on 2026-09-11, the production email identity in ADR-009
on 2026-09-13, and the API-owned Better Auth implementation direction in ADR-010 on 2026-09-16.
Accepted direction is not implemented state: each runtime row remains Proposed until the owning
phase provides verification. Exact dependency versions are selected and pinned during scaffolding,
not frozen in planning prose.

| Area | Planning decision | State | Architecture / ADR reference |
| --- | --- | --- | --- |
| Repository | pnpm modular monorepo with separate web, API, and worker entrypoints. | Accepted direction; Proposed implementation | [ADR-001](_docs/decisions/README.md#adr-001--use-a-pnpm-modular-monorepo-with-three-runtime-entrypoints) |
| Frontend | Next.js App Router, project-owned CSS tokens/modules, wrapped selective Mantine primitives, and TanStack Query; add Zustand only for demonstrated cross-route state. | Accepted direction; Proposed implementation | [ADR-006](_docs/decisions/README.md#adr-006--own-projector-noir-and-use-mantine-selectively) |
| Backend / auth boundary | NestJS modular REST/SSE API owns same-origin Better Auth OAuth, explicit provider linking, and PostgreSQL-backed opaque sessions; Next.js remains presentation, not auth authority. | Accepted direction; Partial implementation — Google sign-in and deny-by-default protected-boundary authorization are active locally; the reviewed Apple implementation and linking safeguards are retained behind a default-off server gate; owner provider runs remain pending | [ADR-002](_docs/decisions/README.md#adr-002--keep-authentication-and-sessions-at-the-api-boundary), [ADR-010](_docs/decisions/README.md#adr-010--use-better-auth-at-the-api-boundary) |
| Database | PostgreSQL with committed, reviewed Prisma/manual SQL migrations and database-enforced invariants. | Accepted direction; Proposed implementation | [ADR-003](_docs/decisions/README.md#adr-003--use-postgresql-and-reviewed-prisma-migrations) |
| Jobs / async | Redis + BullMQ execution with a PostgreSQL transactional outbox, idempotent consumers, and reconciliation. | Accepted direction; Proposed implementation | [ADR-004](_docs/decisions/README.md#adr-004--use-bullmq-with-a-transactional-outbox) |
| Storage | S3-compatible private object storage for user/Club avatars and generated exports; bundled brand assets remain static. | Accepted direction; Proposed implementation | [ADR-007 storage scope](_docs/decisions/README.md#adr-007--use-a-proportional-dokploy-deployment-baseline) |
| Deployment | Separate Dokploy UAT/production projects with managed PostgreSQL/Redis, one source-built application Compose resource, ordered release/health gates, revision traceability, and no host-published ports. UAT builds current `main`; manual production promotion pins its exact UAT-proven revision to an immutable SemVer tag and stays disabled by default. | Accepted direction; Partial implementation | [ADR-007](_docs/decisions/README.md#adr-007--use-a-proportional-dokploy-deployment-baseline), [ADR-008](_docs/decisions/README.md#adr-008--promote-source-built-production-from-uat-proven-semver-tags) |

## 10. External Integrations

| Provider / capability | Purpose | MVP status | Architecture reference |
| --- | --- | --- | --- |
| Google OAuth | Registered identity. | Implemented locally; owner sandbox/UAT evidence pending | [External integrations](ARCHITECTURE.md#external-integrations) |
| Apple Sign in | Registered identity after approved activation. | Implementation retained but dormant by default; owner Apple Developer Program approval and sandbox/UAT evidence required before enablement | [External integrations](ARCHITECTURE.md#external-integrations) |
| TMDB | Film search, metadata, credits, images, and related titles. | Planned | [External integrations](ARCHITECTURE.md#external-integrations) |
| Paddle | Merchant of record, checkout, recurring subscription state, invoices, portal, tax handling. | Planned | [External integrations](ARCHITECTURE.md#external-integrations) |
| Resend | Transactional and opted-in email notifications. | Planned | [External integrations](ARCHITECTURE.md#external-integrations) |
| S3-compatible storage | Avatar uploads and time-limited export artifacts. | Planned | [External integrations](ARCHITECTURE.md#external-integrations) |
| Sentry | Error and performance visibility with privacy-safe context. | Planned | [External integrations](ARCHITECTURE.md#external-integrations) |
| IMDb/Wikipedia links | Optional outbound Movie Details links built from trusted identifiers. | Planned | [External integrations](ARCHITECTURE.md#external-integrations) |

## 11. Phase Plan

Each delivery phase owns one independently verifiable outcome. Verification gates occur after every five delivery phases. They supplement, rather than postpone, automated tests and focused manual checks inside each feature phase.

### Phase elaboration and evidence contract

- Keep future phases at the detail level below: dependencies, meaningful scope, observable acceptance, expected evidence, deliverables, and exclusions.
- Before a phase starts, create or confirm focused Project 3 issues for its delivery slices, then create `_docs/phase-N-short-name.md` with issue links, implementation-level decisions, inherited behavior, temporary shims/removals, edge cases, and verification commands.
- Project 3 owns live task status. Update the Roadmap only at phase boundaries with phase-level acceptance evidence.
- Link the active phase document from `_docs/README.md` while work is in progress.
- On completion, consolidate durable product/design/architecture/operations knowledge into its canonical document, record evidence in this Roadmap, and delete the temporary phase document.
- Do not mark a phase Done with unchecked acceptance items, missing evidence, or undocumented deferred work.
- A Human Verification & Bug Fixing gate produces a severity-classified issue register. Blockers and Majors must be fixed before continuing; lower-severity deferrals require a Roadmap Decision Log entry or a later owning phase.

### Phase 0 — Guidance Baseline · Done

**Goal:** Establish one coherent, source-backed product/design/architecture contract and reusable source layout.

**Dependencies:** None.

**Tickets:** None. Phase 0 was completed before Project 3 became the actionable delivery tracker; no retroactive implementation issue was created.

**Scope:**

- [x] Audit the retired blueprints, canonical designs, UX flow, design system, responsive rules, and asset inventory.
- [x] Resolve material product conflicts with the developer.
- [x] Create and align the canonical guidance set.
- [x] Organize the self-contained prototypes and reusable production brand assets.
- [x] Validate paths, manifests, and guidance integrity.

**Acceptance Check:**

- [x] Guidance validator passes with no placeholders or broken links.
- [x] Canonical design package remains self-contained.
- [x] Production brand assets have a verified reusable inventory.

**Evidence:** Project-guidance validator passed all seven required documents; prototype scan passed 26 HTML files and 584 static local references; JSON validation passed; the brand manifest and dimensions passed for 24 assets; retired blueprints and OS metadata are absent.

**Deliverables:** Roadmap, Design, Architecture, agent instructions, docs map, ADR registry, organized prototypes, and brand assets.

**Out of scope:** Application scaffolding or dependency installation.

### Phase 1 — Infrastructure, Repository & Deployment Foundation · In progress

**Goal:** Create a reproducible monorepo/runtime foundation, prove it through automatic UAT delivery, and prepare a disabled production-promotion path for every later vertical slice.

**Dependencies:** Phase 0 guidance; accepted foundational ADRs; DNS control of `pick-flick.app` before UAT provisioning.

**Tickets:**

- [1.1 — Approve the Phase 1 architecture and ADR baseline (#9)](https://github.com/Shagon1k/PickFlick/issues/9)
- [1.2 — Scaffold the typed pnpm monorepo and executable command map (#10)](https://github.com/Shagon1k/PickFlick/issues/10)
- [1.3 — Establish local data services, migrations, seeds, and typed configuration (#11)](https://github.com/Shagon1k/PickFlick/issues/11)
- [1.4 — Add health, readiness, structured logging, correlation, and stable API errors (#12)](https://github.com/Shagon1k/PickFlick/issues/12)
- [1.5 — Build production images and the shared UAT/production Compose topology (#13)](https://github.com/Shagon1k/PickFlick/issues/13)
- [1.6 — Replace placeholder CI with reproducible quality gates (#14)](https://github.com/Shagon1k/PickFlick/issues/14)
- [1.7 — Provision isolated UAT and automatic exact-revision delivery (#15)](https://github.com/Shagon1k/PickFlick/issues/15)
- [1.8 — Prepare guarded production promotion and deployment runbooks (#16)](https://github.com/Shagon1k/PickFlick/issues/16)

**Scope:**

- [x] Decide and record repository topology, auth-boundary direction, database workflow, queue/outbox approach, Dokploy/Cloudflare deployment baseline, and UI primitive strategy.
- [ ] Scaffold web, API, worker, database, contracts, UI, and configuration packages without retaining unused generated files.
- [ ] Establish PostgreSQL, Redis, object-storage, and Resend configuration with typed environment validation.
- [ ] Create the initial Prisma/migration workflow, seed/test-fixture strategy, and safe reset policy for non-production environments.
- [ ] Add real install/dev/build/lint/type-check/test/migrate/seed, image-build, Compose-validation, and E2E-smoke commands and update `AGENTS.md`.
- [ ] Keep production-oriented web, API, worker, and one-shot release images; align the shared application Compose definition with Dokploy-managed PostgreSQL/Redis, ordered release/health gates, revision traceability, private ports, and baseline signal handling.
- [ ] Provision the isolated UAT deployment through Dokploy and Cloudflare at `https://uat.pick-flick.app` with synthetic data and sandbox providers.
- [ ] Prepare the checked-in production Dokploy and environment contract for `https://pick-flick.app`, with automatic deployment disabled and an explicit production-enable guard kept false. Defer live production resource provisioning to #94.
- [ ] Replace the placeholder CI job with real quality gates; deploy a green `main` revision automatically to UAT, wait for the exact Dokploy revision, and run health plus browser smoke checks.
- [ ] Add a dormant manual SemVer production-promotion workflow that accepts only the current `main` revision with successful exact UAT evidence, pins production to its immutable tag, and cannot deploy while the production-enable guard is false. Defer registry-backed digest promotion until separate build/deployment hosts or another concrete artifact-identity requirement makes it necessary.
- [ ] Establish typed environment inventories, secret/build-time/runtime boundaries, structured logging, request/job correlation, health/readiness endpoints, and a stable API error envelope.
- [ ] Document deployment, configuration, migration compatibility, UAT smoke, rollback, and production-enable procedures without recording secret values.

**Acceptance Check:**

- [ ] A clean checkout installs, starts required services, migrates, seeds, and runs web/API/worker from documented commands.
- [ ] Lint, type-check, unit test, integration test, production builds, image builds, and Compose validation pass locally and in CI.
- [ ] A green `main` revision deploys automatically to `https://uat.pick-flick.app`, and the exact deployed revision passes HTTPS health and browser smoke checks.
- [ ] A failed release migration/seed prevents the new API, worker, and web revision from becoming active.
- [ ] Repository validation proves that UAT and production configuration selects distinct projects, credentials, storage scopes, application networks, and private service aliases, with no directly published application or data-service port. Verify the live production resources under #94.
- [ ] A known-good UAT revision can be restored under the documented schema-compatibility rules.
- [ ] The production workflow and configuration validate without deploying production while the production-enable guard is false.
- [ ] Invalid/missing configuration fails safely without exposing secrets.
- [ ] Architecture/ADR documentation matches the generated repository and runtime topology.

**Evidence:** ADR-001 through ADR-006 were accepted on 2026-09-05; ADR-007 superseded the deployment
baseline on 2026-09-07 after comparison with Dokploy capabilities and TailorTales operations.
Remaining Phase 1 evidence: local/CI command logs, image builds, the proportional Compose
validation, migration/idempotent-seed output, exact UAT revision and Dokploy deployment record,
Cloudflare DNS/TLS checks, health/E2E results,
failed-release gate, UAT rollback exercise, production-disabled guard test, and repository tree
review.

**Deliverables:** Runnable monorepo, local dependency stack, real CI, database foundation, typed configuration, production-oriented images, proportional application Compose, Dokploy-managed remote data services, operational UAT, inactive production-promotion path, deployment/environment/runbook guidance, and real command map.

**Out of scope:** Production traffic cutover, real production users/data, activation of live billing/email/storage providers, final production restore drill, production UI, and end-user feature behavior.

### Phase 2 — Production Design System & App Shells · In progress

**Goal:** Translate Projector Noir into reusable production foundations and responsive public/private/admin shells.

**Dependencies:** Phase 1 runnable web foundation.

**Tickets:**

- [2.1 — Implement Projector Noir tokens, brand assets, and accessible UI primitives (#17)](https://github.com/Shagon1k/PickFlick/issues/17)
- [2.2 — Establish component accessibility, viewport, and visual-regression QA (#18)](https://github.com/Shagon1k/PickFlick/issues/18)
- [2.3 — Build responsive public, setup, product, Session, Settings, Library, and Admin shells (#19)](https://github.com/Shagon1k/PickFlick/issues/19)

**Scope:**

- [ ] Implement approved color, typography, spacing, layout, border/elevation, imagery, and motion tokens from the canonical design contract.
- [ ] Build accessible buttons, fields, toggles, tabs, menus, dialogs, progress, banners, tables, feedback, and rating/score primitives.
- [ ] Build public, authenticated, Session-detail, Settings/Library, and App Admin shell structures without feature data coupling.
- [ ] Implement S/M/L/XL responsive composition, fixed mobile navigation, bounded table scrolling, and 44px touch targets.
- [ ] Add reduced-motion, keyboard/focus, component-state, visual-regression, and accessibility test harnesses.
- [ ] Wire normalized brand assets through a single reusable asset contract.

**Acceptance Check:**

- [ ] Shared primitives cover default, hover, focus, pressed, loading, disabled, validation, success, and destructive states where applicable.
- [ ] Shells work at representative 390, 768, 1024, and 1440 widths without horizontal page scrolling.
- [ ] Keyboard/touch interaction and automated accessibility checks pass for the shared component set.
- [ ] Source-comparison captures are recorded and Design build/QA status is updated honestly.

**Evidence:** Story/demo routes, component tests, accessibility output, viewport captures, visual diffs, and Design updates.

**Deliverables:** Production token/component layer, responsive shells, and visual/accessibility QA harness.

**Out of scope:** Complete page content or business mutations.

### Phase 3 — Public Site & System States · In progress

**Goal:** Deliver the complete public-facing PickFlick story and safe recovery surfaces.

**Dependencies:** Phase 2 public shell and primitives; the production contact and environment-specific
sender identities are fixed by
[ADR-009](_docs/decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders).

**Tickets:**

- [3.1 — Confirm production contact and email sender identity (#20)](https://github.com/Shagon1k/PickFlick/issues/20)
- [3.2 — Build the responsive Landing and Pricing experiences (#21)](https://github.com/Shagon1k/PickFlick/issues/21)
- [3.3 — Deliver the Contact form and privacy-safe message handling (#22)](https://github.com/Shagon1k/PickFlick/issues/22)
- [3.4 — Add public legal-entry routes and indexing metadata boundaries (#23)](https://github.com/Shagon1k/PickFlick/issues/23)
- [3.5 — Implement branded not-found and application-error recovery (#24)](https://github.com/Shagon1k/PickFlick/issues/24)

**Scope:**

- [ ] Implement Landing, Pricing, and Contact surfaces from canonical designs.
- [ ] Implement privacy/terms entry routes with clearly provisional copy until legal review.
- [ ] Implement branded not-found and application-error recovery surfaces.
- [ ] Wire the contact form with validation, rate limiting, stable success/error feedback, and privacy-safe delivery/storage.
- [ ] Add baseline metadata, canonical URLs, social previews, robots, sitemap, and noindex boundaries for non-public routes.
- [ ] Cover loading, provider/network failure, long-content, and reduced-motion behavior.

**Acceptance Check:**

- [ ] Every public route matches its responsive source and is usable with keyboard, touch, and assistive technology.
- [ ] Contact submission handles valid, invalid, duplicate, rate-limited, and delivery-failure cases without losing safe input.
- [ ] 404/500 recovery never reveals internal details and offers working navigation/retry.
- [ ] Metadata and indexing rules are correct in a production build.

**Evidence:** E2E runs, responsive captures, accessibility results, contact integration tests, and metadata/robots inspection.

**Deliverables:** Public marketing/contact/legal-entry/system-state vertical slice.

**Out of scope:** Registration, authenticated pages, live billing checkout, and final legal approval.

### Phase 4 — Authentication & Account Onboarding · In progress

**Goal:** Let a person become a registered PickFlick User through an available approved provider and safely retain intended navigation. Apple remains dormant pending separate owner approval and provisioning.

**Dependencies:** Phase 1 identity foundation; Phase 2 authenticated shell; confirmed OAuth callback configuration.

**Tickets:**

- [4.1 — Select the auth/session library and account-linking contract (#25)](https://github.com/Shagon1k/PickFlick/issues/25)
- [4.2 — Implement Google OAuth, secure sessions, and return-to-intent (#26)](https://github.com/Shagon1k/PickFlick/issues/26)
- [4.3 — Add Sign in with Apple and safe identity linking (#27)](https://github.com/Shagon1k/PickFlick/issues/27)
- [4.4 — Enforce authentication, suspension, revocation, and global roles at every boundary (#28)](https://github.com/Shagon1k/PickFlick/issues/28)

**Scope:**

- [x] Choose and record the auth/session implementation and account-linking contract.
- [ ] Implement Google and Apple OAuth against the accepted API-owned contract.
- [ ] Implement secure server-managed sessions, callback validation, sign-out, session revocation, and account linking rules.
- [ ] Implement Login and initial account/profile bootstrap from provider-safe fields.
- [ ] Preserve and validate return-to-intent for app, Club invitation, and safe fallback routes.
- [ ] Enforce User/App Admin global roles and suspended-user denial at route, API, SSE, and file boundaries.
- [ ] Add auth abuse protection, security logging without token leakage, and provider-failure recovery.

**Acceptance Check:**

- [ ] New and returning Users can sign in/out through each enabled provider and reach the intended authorized destination; dormant providers are unavailable in UI and API.
- [ ] Invalid state/nonce/callback, provider denial, duplicate identity, suspension, expiry, and revoked-session cases fail safely.
- [ ] Protected routes and APIs reject unauthenticated/forged access independently of UI controls.
- [ ] Auth integration/E2E/security checks pass without provider tokens in browser storage or logs.

**Evidence:** Provider sandbox runs, auth integration/E2E tests, session-revocation proof, log review, and accepted auth ADR.

**Deliverables:** Registered-user identity/session vertical slice.

**Out of scope:** Anonymous use, password authentication, Club membership, and complete profile settings.

### Phase 5 — Clubs, Membership & Roles · Not started

**Goal:** Create the secure private Club boundary and its role/entitlement invariants.

**Dependencies:** Phase 4 registered identity; Phase 1 database; Phase 2 authenticated shell.

**Tickets:**

- [5.1 — Implement Club membership, roles, constraints, and policy projections (#29)](https://github.com/Shagon1k/PickFlick/issues/29)
- [5.2 — Deliver no-Clubs and Create Club onboarding with Selection-scale setup (#30)](https://github.com/Shagon1k/PickFlick/issues/30)
- [5.3 — Add Club settings, lifecycle, role management, and destructive safeguards (#31)](https://github.com/Shagon1k/PickFlick/issues/31)

**Scope:**

- [ ] Implement Club, Membership, Admin/Moderator/Member roles, settings, lifecycle, and audit-safe role transitions.
- [ ] Implement the no-Clubs state and Create Club flow, including configurable `0..N` or `1..N` Selection scale.
- [ ] Enforce one Admin maximum, temporary adminless state, unique Membership, Free defaults, and plan-derived limits.
- [ ] Implement Club edit, archive/reactivate, leave, and delete foundations with explicit confirmations.
- [ ] Build server-side policy guards/projections for Admin, Moderator, Member, App Admin, suspended User, and non-member.
- [ ] Seed/test plan entitlements without Paddle; the Billing module will replace fixture subscription state in Phase 20.

**Acceptance Check:**

- [ ] The complete role/limit/action matrix passes integration tests, including forged requests and adminless Clubs.
- [ ] Club creation validates names, limits, and score ranges transactionally.
- [ ] Destructive and ownership-sensitive actions are audited and never rely on hidden UI alone.
- [ ] No-Clubs/Create Club/member views match their responsive design sources.

**Evidence:** Database constraints, policy/integration tests, role matrix, audit examples, E2E captures, and guidance updates.

**Deliverables:** Club/membership domain, role policies, onboarding states, and Club creation/settings foundation.

**Out of scope:** Invitations, full Club Hub data, Sessions, and live subscription billing.

### Phase 6 — Human Verification & Bug Fixing I · Not started

**Goal:** Stabilize the foundation, design system, public/auth flows, and Club boundary before building the core movie-night workflow.

**Dependencies:** Phases 1–5 complete with their own evidence.

**Tickets:**

- [6.1 — Verify and stabilize Phases 1–5 in UAT (#32)](https://github.com/Shagon1k/PickFlick/issues/32)

**Scope:**

- [ ] Create `_docs/phase-6-human-verification-1.md` with a severity-classified issue register and tested build/environment.
- [ ] Manually exercise clean setup, public/contact/error, Google/Apple auth, no-Clubs, Club creation, roles, limits, and destructive flows.
- [ ] Compare all delivered surfaces at S/M/L/XL widths and keyboard/touch/reduced-motion modes against canonical designs.
- [ ] Perform negative authorization, session-revocation, validation, configuration, migration, and provider-failure checks.
- [ ] Fix all Blocker/Major issues and re-run focused checks after each affected subsystem change.
- [ ] Explicitly defer remaining Minor/Polish issues with ownership/revisit trigger; consolidate durable docs and remove completed staging docs.

**Acceptance Check:**

- [ ] No open Blocker or Major issue remains.
- [ ] Full CI and critical E2E/accessibility/responsive suites pass after fixes.
- [ ] Manual evidence covers the five completed delivery phases and documentation matches verified behavior.
- [ ] The issue register records every finding, fix, retest, and approved deferral.

**Evidence:** Verification document, issue register, before/after captures, test runs, auth/role matrix, and documentation diff.

**Deliverables:** Stabilized first product foundation and clean midstream documentation baseline.

**Out of scope:** New product capability unrelated to resolving verification findings.

### Phase 7 — Club Hub & Club Invitations · Not started

**Goal:** Make Clubs navigable, understandable, and joinable through the approved Hub and invitation experiences.

**Dependencies:** Phase 6 stabilization; Phase 5 Club/membership model.

**Tickets:**

- [7.1 — Build Club switching, post-login routing, and the Hub overview (#33)](https://github.com/Shagon1k/PickFlick/issues/33)
- [7.2 — Implement the secure Club invitation lifecycle (#34)](https://github.com/Shagon1k/PickFlick/issues/34)
- [7.3 — Complete Hub membership, moderation, adminless, and read-only states (#35)](https://github.com/Shagon1k/PickFlick/issues/35)

**Scope:**

- [ ] Implement Club switcher/carousel and authenticated post-login routing to last Club or no-Clubs state.
- [ ] Implement Hub Overview, Members, Manage Club foundation, recent activity, basic counters, and empty/loading/read-only states.
- [ ] Implement Club invite creation, token hashing/expiry/revocation, privacy-safe preview, auth continuation, accept/decline, and member-limit enforcement.
- [ ] Implement the shared pending-invite ticket/popover contract; Session-specific rows are completed in Phase 9.
- [ ] Implement moderator management, member leave/removal boundaries, and adminless notifications visible from the Hub.
- [ ] Ensure downgrade/read-only projections can later be supplied by Phase 20 without redesigning Hub actions.

**Acceptance Check:**

- [ ] A registered User can accept/decline a valid Club invitation and land in the correct Hub.
- [ ] Expired/revoked/over-limit/already-member/non-target invitations reveal only safe information and recover clearly.
- [ ] Club switching never leaks cached data or permissions between Clubs.
- [ ] Hub and invite surfaces match responsive/keyboard/touch design contracts.

**Evidence:** Invite security/integration tests, Club-switch E2E, responsive captures, and policy checks.

**Deliverables:** Usable Club Hub foundation, Club switcher, invitation lifecycle, and member management UI.

**Out of scope:** Session creation, advanced statistics, leaderboard, and achievements.

### Phase 8 — Movie Catalog, TMDB & Global Search · Not started

**Goal:** Establish one trusted Movie identity/search/detail layer for every nomination, history, and Library feature.

**Dependencies:** Phase 1 worker/database foundation; Phase 2 shell/search primitives; Phase 4 authentication.

**Tickets:**

- [8.1 — Integrate TMDB and canonicalize cached Movie records (#36)](https://github.com/Shagon1k/PickFlick/issues/36)
- [8.2 — Deliver authenticated global Movie search (#37)](https://github.com/Shagon1k/PickFlick/issues/37)
- [8.3 — Build Movie Details, credits, trailers, trusted links, and related titles (#38)](https://github.com/Shagon1k/PickFlick/issues/38)

**Scope:**

- [ ] Implement the TMDB adapter, server-held credentials, search/detail/credits/media mapping, rate-limit handling, and cache freshness state.
- [ ] Implement the canonical Movie record keyed by TMDB identity with transactional upsert/deduplication.
- [ ] Implement authenticated global film search with loading, no-results, stale-safe, provider-error, and keyboard behavior.
- [ ] Implement Movie Details metadata/trailer/credits/outbound trusted links and provider-backed related titles.
- [ ] Add refresh jobs and App Admin-configurable refresh cadence contract for later Phase 21 wiring.
- [ ] Keep fixture poster/still assets out of production data and record required TMDB attribution/usage.

**Acceptance Check:**

- [ ] Search/detail results are deduplicated, safely encoded, cached intentionally, and recover from provider failure/rate limiting.
- [ ] Global search is authorized, responsive, keyboard-accessible, and routes to stable Movie identities.
- [ ] Refresh jobs are idempotent and observable; stale data is used only where explicitly safe.
- [ ] Movie Details matches canonical design structure without implying AI personalization.

**Evidence:** Provider-contract tests, cache/refresh tests, search/Movie E2E, accessibility results, and design captures.

**Deliverables:** Movie/TMDB module, global search, Movie Details read surface, and refresh foundation.

**Out of scope:** Personal Rating, Watchlist mutations, AI recommendations, and Session nominations.

### Phase 9 — Session Creation & Participant Roster · Not started

**Goal:** Create full-cycle and pre-selected Sessions with a secure member-only roster and one-blocking-Session guarantee.

**Dependencies:** Phase 7 Clubs/invitations; Phase 8 Movie search; Phase 1 worker/database.

**Tickets:**

- [9.1 — Establish Session, roster, settings snapshots, and the blocking-Session invariant (#39)](https://github.com/Shagon1k/PickFlick/issues/39)
- [9.2 — Build full-cycle and pre-selected Session creation, editing, and cancellation (#40)](https://github.com/Shagon1k/PickFlick/issues/40)
- [9.3 — Implement member-only Session invitations and roster management (#41)](https://github.com/Shagon1k/PickFlick/issues/41)

**Scope:**

- [ ] Implement Session, SessionParticipant, SessionInvite, type, phase, date/location/topic/notes, and edit/cancel foundations.
- [ ] Enforce the PostgreSQL/transactional invariant allowing one Nomination/Selection/Watching Session per Club and unlimited Rating Sessions.
- [ ] Implement Create Session modes, required fields, optional nomination deadline, pre-selected Movie search, and result state.
- [ ] Implement member-only Session invitations, accepted roster, leave/remove behavior, expiry, and generic non-member denial with join-Club hint.
- [ ] Add active/Rating/history row projections needed by the Hub without treating prototype variant rows as concurrent fixtures.
- [ ] Snapshot relevant Club settings/score range and define roster denominator/version behavior for later automatic transitions.

**Acceptance Check:**

- [ ] Full-cycle and pre-selected Sessions validate and enter the correct initial phase.
- [ ] Concurrent requests cannot create two blocking Sessions in one Club; Rating Sessions do not block creation.
- [ ] Non-members learn no Session detail and accepting a Session invite never creates Club membership.
- [ ] Roster changes and Session edits are authorized, audited where sensitive, and reflected consistently.

**Evidence:** Database concurrency tests, Session/invite integration tests, Create Session E2E, role checks, and Hub row captures.

**Deliverables:** Session/roster/invite domain and creation flows.

**Out of scope:** Nomination submission, Selection ballots, watching/rating completion, and past-session entry.

### Phase 10 — Nomination & Deadline Automation · Not started

**Goal:** Let every eligible participant nominate one film and advance safely through complete or expired Nomination.

**Dependencies:** Phase 9 Session/roster; Phase 8 Movies; Phase 1 worker/outbox; notification events may be stored before Phase 17 adds the inbox/preferences UI.

**Tickets:**

- [10.1 — Implement Nomination submissions, Club Bench, and visibility rules (#42)](https://github.com/Shagon1k/PickFlick/issues/42)
- [10.2 — Automate Nomination deadlines with durable reconciliation (#43)](https://github.com/Shagon1k/PickFlick/issues/43)
- [10.3 — Serialize automatic Nomination transitions and publish live progress events (#44)](https://github.com/Shagon1k/PickFlick/issues/44)

**Scope:**

- [ ] Implement Nomination and Club Bench entities, one-nomination-per-participant constraint, TMDB selection, and bench shortcuts.
- [ ] Implement the Nomination Session detail state, participant progress, visibility policies, submission locking, and operator controls.
- [ ] Implement durable delayed deadline jobs, stable job IDs, stale-job guards, periodic overdue reconciliation, and safe deadline changes/cancellation.
- [ ] Implement automatic `N/N` transition: two or more nominations open Selection; one selects the sole Movie and advances to Watching.
- [ ] Implement deadline behavior: zero stays open and alerts operators; one advances to Watching; two or more open Selection.
- [ ] Write transactional outbox/domain events for progress and future in-app/email notification delivery.

**Acceptance Check:**

- [ ] Duplicate/concurrent nomination attempts cannot violate uniqueness or advance the Session twice.
- [ ] Complete, sole-nomination, zero/one/many-at-deadline, changed-deadline, cancelled, restart, and reconciliation cases pass.
- [ ] Visibility settings prevent pre-submission or nominator disclosure when disabled.
- [ ] Nomination UI/progress/controls match canonical responsive and accessibility behavior.

**Evidence:** Domain/transaction/worker tests, clock-controlled deadline tests, multi-client E2E, event records, and design captures.

**Deliverables:** Nomination phase, Club Bench, deadline automation, and transition/event foundation.

**Out of scope:** Selection scoring and final notification inbox/email delivery.

### Phase 11 — Selection & Winner Resolution · Not started

**Goal:** Collect immutable scored ballots and resolve one winner deterministically under automatic or operator-controlled closure.

**Dependencies:** Phase 10 Nomination/transition foundation and Phase 9 roster/Club score snapshot.

**Tickets:**

- [11.1 — Build immutable Selection ballots and generated score controls (#45)](https://github.com/Shagon1k/PickFlick/issues/45)
- [11.2 — Resolve winners deterministically under automatic and early closure (#46)](https://github.com/Shagon1k/PickFlick/issues/46)
- [11.3 — Publish policy-filtered Selection results and live updates (#47)](https://github.com/Shagon1k/PickFlick/issues/47)

**Scope:**

- [ ] Implement SelectionBallot/SelectionScore with one score per nomination and validation against the Session’s `0..N` or `1..N` snapshot.
- [ ] Implement Selection Session detail, generated score controls, completeness validation, immutable submission, progress, and permitted result visibility.
- [ ] Implement automatic transition when all `N` participant ballots arrive.
- [ ] Implement operator early closure over received ballots and deterministic tie-break sequence from Section 5.
- [ ] Store explainable winner/tie-break outcome and immutable result inputs for completed history/audit.
- [ ] Publish progress/winner events through outbox and live Session update foundations.

**Acceptance Check:**

- [ ] Every supported scale, incomplete ballot, duplicate submit, early closure, no-ballot, and roster-change case behaves explicitly.
- [ ] Ties resolve repeatably through every ordered tie-break step and cannot change on retry.
- [ ] Automatic/manual/concurrent closure advances once and selects the same winner.
- [ ] Hidden results/nominator identity remain server-filtered; Selection UI is accessible and responsive.

**Evidence:** Table-driven scoring/tie tests, transaction/concurrency tests, multi-client E2E, result projection checks, and design captures.

**Deliverables:** Selection phase, deterministic winner service, immutable ballot history, and live result events.

**Out of scope:** Watching, Rating, and full notification preferences/delivery.

### Phase 12 — Human Verification & Bug Fixing II · Not started

**Goal:** Stabilize Club navigation, Movie integration, Session creation, Nomination, deadlines, and Selection before adding completion/history layers.

**Dependencies:** Phases 7–11 complete with evidence; Phase 6 findings resolved/deferred.

**Tickets:**

- [12.1 — Verify and stabilize the Club-to-winner journey in UAT (#48)](https://github.com/Shagon1k/PickFlick/issues/48)

**Scope:**

- [ ] Create `_docs/phase-12-human-verification-2.md` with environment/build identity and severity-classified findings.
- [ ] Manually run multi-user Club invite, switcher, Movie search, Session roster/invite, Nomination, deadline, Selection, early closure, and tie journeys.
- [ ] Exercise concurrent tabs/users, process/job restarts, SSE reconnect/fallback, stale data, TMDB failures, and permission changes mid-flow.
- [ ] Compare delivered screens at S/M/L/XL plus keyboard/touch/reduced-motion and long/empty/error/read-only content.
- [ ] Fix every Blocker/Major and retest affected domain, worker, API, and UI boundaries.
- [ ] Consolidate durable docs, remove completed phase staging files, and explicitly schedule accepted lower-severity debt.

**Acceptance Check:**

- [ ] No open Blocker or Major issue remains.
- [ ] The full Club-to-winner journey passes manual and automated multi-user verification.
- [ ] Deadline/transition/tie/authorization invariants survive retry and concurrency testing.
- [ ] Documentation and issue disposition match verified behavior.

**Evidence:** Gate document, issue register, multi-user recordings/captures, job/concurrency logs, full test suite, and documentation diff.

**Deliverables:** Stabilized decision half of the core movie-night loop.

**Out of scope:** New feature work unrelated to verification findings.

### Phase 13 — Watching, Rating & Completion · Not started

**Goal:** Complete the core Session lifecycle while allowing unfinished ratings to remain non-blocking.

**Dependencies:** Phase 12 stabilized winner flow; Phase 9 one-blocking-Session invariant.

**Tickets:**

- [13.1 — Deliver Watching state and the manual transition to Rating (#49)](https://github.com/Shagon1k/PickFlick/issues/49)
- [13.2 — Implement historical Session Ratings and idempotent completion (#50)](https://github.com/Shagon1k/PickFlick/issues/50)
- [13.3 — Build Completed Session history and non-blocking Rating projections (#51)](https://github.com/Shagon1k/PickFlick/issues/51)

**Scope:**

- [ ] Implement Watching detail state, selected Movie/session context, attendance status, edit/invite/leave/operator controls.
- [ ] Implement the manual Watching → Rating transition and release the Club’s blocking-Session slot transactionally.
- [ ] Implement SessionRating 1–10 with optional comment, one per participant, progress, permitted individual/result visibility, and historical immutability after completion.
- [ ] Implement automatic completion at `N/N` and Admin/Moderator early completion with partial ratings.
- [ ] Implement Completed detail with Movie, attendees, notes, ratings, nomination rivals, votes, and policy-filtered breakdowns.
- [ ] Update Hub active/Rating/history projections and ensure unlimited Rating Sessions coexist with one new blocking Session.

**Acceptance Check:**

- [ ] Watching never advances automatically from page presence; authorized operator action is required.
- [ ] All-rated and partial-manual completion are idempotent and preserve exactly the received historical ratings.
- [ ] Multiple Rating Sessions can remain open while one Nomination/Selection/Watching Session runs.
- [ ] Watching/Rating/Completed screens and visibility policies pass responsive/accessibility/authorization checks.

**Evidence:** State/concurrency tests, completion/visibility integration tests, multi-session E2E, aggregate snapshots, and design captures.

**Deliverables:** Full live Session lifecycle and durable Completed history.

**Out of scope:** Past-session entry, editable Personal Rating, and achievements.

### Phase 14 — Past Sessions & Shared History · Not started

**Goal:** Record pre-PickFlick screenings with incomplete but trustworthy historical evidence.

**Dependencies:** Phase 13 completion model; Phase 8 Movies; Phase 5 Membership history.

**Tickets:**

- [14.1 — Record minimal past Sessions with attendees and optional ratings (#52)](https://github.com/Shagon1k/PickFlick/issues/52)
- [14.2 — Reconstruct optional historical nominations and score matrices safely (#53)](https://github.com/Shagon1k/PickFlick/issues/53)

**Scope:**

- [ ] Implement Create Past Session date/location/Movie/topic/notes and attendee selection.
- [ ] Support optional attendee 1–10 ratings with provenance distinct from live submissions.
- [ ] Support optional historical nomination list and participant-by-nomination score matrix using the Club scale snapshot.
- [ ] Reuse completed-history projections without fabricating missing participants, ballots, or phase timestamps.
- [ ] Validate duplicate Movies, departed members, partial rows, malformed score matrices, and permission failures.
- [ ] Preserve historical Membership/attendee attribution under later account deletion/anonymization.

**Acceptance Check:**

- [ ] A valid minimal past Session can be stored with no nomination or rating data.
- [ ] Optional historical fields validate independently and never imply completeness that was not supplied.
- [ ] Imports/entries are authorized, auditable, deduplicated, and visible in the correct Club history.
- [ ] Past Session form and resulting Completed view match canonical responsive/validation behavior.

**Evidence:** Partial-data integration tests, validation matrix, past-session E2E, history projections, and design captures.

**Deliverables:** Past-session entry and shared historical record support.

**Out of scope:** Bulk third-party history import and personal CSV import/export.

### Phase 15 — Personal Library, Ratings & Watchlist · Not started

**Goal:** Give each User a durable, editable personal film memory independent from shared Session history.

**Dependencies:** Phase 8 Movies; Phase 13 Session Ratings; Phase 14 shared history.

**Tickets:**

- [15.1 — Implement editable Personal Ratings without rewriting Session history (#54)](https://github.com/Shagon1k/PickFlick/issues/54)
- [15.2 — Add the prioritized personal Watchlist across Movie and Library surfaces (#55)](https://github.com/Shagon1k/PickFlick/issues/55)
- [15.3 — Build searchable and filterable My Library views (#56)](https://github.com/Shagon1k/PickFlick/issues/56)

**Scope:**

- [ ] Implement one editable PersonalMovieRating per User/Movie with source/update metadata.
- [ ] On Session Rating submission, update the current Personal Rating without rewriting the historical Session Rating.
- [ ] Implement Watchlist add/edit/remove with Low/Medium/High priority and stable duplicate behavior.
- [ ] Wire Movie Details personal rating/watchlist controls and “You may also like” provider-related titles.
- [ ] Implement My Library Ratings and Watchlist tables, search/filter/sort, empty/loading/error, and bounded mobile behavior.
- [ ] Add personal-library authorization and aggregate foundations needed by Phase 16 and Privacy exports in Phase 19.

**Acceptance Check:**

- [ ] Editing a Personal Rating never changes completed Session/Club history.
- [ ] Session Rating can initialize/update the current Personal Rating idempotently.
- [ ] Watchlist priority and rating controls remain consistent across Movie Details and Library.
- [ ] Library/Movie mutations reject cross-user access and pass responsive/keyboard/touch checks.

**Evidence:** Historical-vs-personal tests, mutation integration tests, Library/Movie E2E, authorization checks, and design captures.

**Deliverables:** Personal Rating, Watchlist, Movie Details mutations, and core My Library views.

**Out of scope:** Recomputing Personal Ratings from all historical viewings and AI recommendations.

### Phase 16 — Club/Personal Statistics & Achievements · Not started

**Goal:** Turn accumulated Club and personal activity into accurate, explainable summaries and achievements.

**Dependencies:** Phases 13–15 provide completed Sessions, ratings, history, and Library data.

**Tickets:**

- [16.1 — Deliver Club statistics and the ratings leaderboard (#57)](https://github.com/Shagon1k/PickFlick/issues/57)
- [16.2 — Deliver deterministic personal Library statistics (#58)](https://github.com/Shagon1k/PickFlick/issues/58)
- [16.3 — Implement versioned Club and personal achievements (#59)](https://github.com/Shagon1k/PickFlick/issues/59)

**Scope:**

- [ ] Implement Club statistics, rating leaderboard, sorting, and basic/extended plan projections without coupling to Paddle transport.
- [ ] Implement personal Library statistics: counts, yearly activity, average, watch time, Watchlist count, favorite genre, top director, and top actor.
- [ ] Implement versioned personal and Club AchievementDefinition/Award/progress evaluation for every canonical design criterion.
- [ ] Make aggregate recomputation deterministic, observable, and safe for historical/partial Sessions.
- [ ] Wire Club Ratings/Achievements and Library Achievements views with unlocked/in-progress/not-started filters.
- [ ] Define how provider metadata changes affect historical genre/person aggregates without rewriting awards silently.

**Acceptance Check:**

- [ ] Aggregates reproduce from canonical fixtures and remain stable across retries/provider refresh.
- [ ] Free/Pro projections expose only permitted analytics and never leak hidden individual results.
- [ ] Achievement award/progress is versioned, idempotent, and explainable from source events/data.
- [ ] Statistics, leaderboard, and achievement screens match responsive/empty/loading/filter behavior.

**Evidence:** Aggregate/achievement fixture tests, recomputation tests, entitlement projections, E2E filters, and design captures.

**Deliverables:** Club/personal analytics, leaderboard, and achievement system.

**Out of scope:** AI-generated insights and Club rating CSV export.

### Phase 17 — Notifications & Preferences · Not started

**Goal:** Deliver durable in-app and opted-in email notifications for lifecycle, membership, inactivity, and billing-ready events.

**Dependencies:** Domain events from Phases 7–16; Phase 1 worker/outbox; Phase 4 identity; Phase 20 later adds Paddle event producers.

**Tickets:**

- [17.1 — Establish durable Notifications, preferences, and safe event mapping (#60)](https://github.com/Shagon1k/PickFlick/issues/60)
- [17.2 — Build the inbox, bell, read state, and resilient SSE updates (#61)](https://github.com/Shagon1k/PickFlick/issues/61)
- [17.3 — Deliver Resend email templates, retries, suppression handling, and observability (#62)](https://github.com/Shagon1k/PickFlick/issues/62)

**Scope:**

- [ ] Implement Notification, delivery attempt, and per-event/channel NotificationPreference storage with explicit mandatory-service exceptions.
- [ ] Map Session/Club/achievement/inactivity events to safe notification payloads and Resend templates.
- [ ] Implement list, unread count, mark one/all read, pagination/recent-list behavior, and privacy-safe entity deletion fallback.
- [ ] Implement authenticated per-user SSE unread/progress delivery with reconnect, initial REST state, and multi-instance Redis distribution.
- [ ] Wire desktop/mobile notification bell/popover and Settings preference matrix from canonical designs.
- [ ] Implement email retry/backoff, suppression/bounce handling, delivery observability, and no-body/no-secret logging policy.

**Acceptance Check:**

- [ ] Bell/list/read state stays consistent across tabs/devices and reconnects without losing authoritative state.
- [ ] Every event/channel combination respects preferences and required-service exceptions.
- [ ] Duplicate events/retries do not create duplicate logical notifications or emails.
- [ ] Notification UI, empty/error/loading, focus/dismissal, and mobile behavior pass design/accessibility checks.

**Evidence:** Event-preference matrix tests, SSE/reconnect E2E, mocked/sandbox email tests, retry metrics, and design captures.

**Deliverables:** Notification inbox/bell, user preferences, real-time unread updates, and email delivery pipeline.

**Out of scope:** Web push and Paddle event production before Phase 20.

### Phase 18 — Human Verification & Bug Fixing III · Not started

**Goal:** Stabilize completion, past history, Library, statistics, achievements, and notifications as one coherent retention loop.

**Dependencies:** Phases 13–17 complete with evidence; earlier gate issues resolved/deferred.

**Tickets:**

- [18.1 — Verify and stabilize the retention loop in UAT (#63)](https://github.com/Shagon1k/PickFlick/issues/63)

**Scope:**

- [ ] Create `_docs/phase-18-human-verification-3.md` and a severity-classified issue register.
- [ ] Run end-to-end Watch → Rate → Complete → History → Personal Library → Stats/Achievements journeys across multiple Clubs and Users.
- [ ] Verify partial Rating closure, multiple Rating Sessions, past data, repeated Movie viewings, Personal-vs-Session Rating separation, and anonymized/departed-member display.
- [ ] Exercise notification preferences, retries, multi-tab SSE, entity deletion, empty/long/error states, and email-safe content.
- [ ] Compare every delivered surface at representative viewports and keyboard/touch/reduced-motion modes.
- [ ] Fix Blockers/Majors, retest, consolidate durable docs, delete completed staging docs, and explicitly schedule remaining debt.

**Acceptance Check:**

- [ ] No open Blocker or Major issue remains.
- [ ] Shared history and Personal Rating invariants survive repeated edits, imports, recomputation, and account/membership changes available so far.
- [ ] Full automated suites and cross-feature manual journeys pass after fixes.
- [ ] Documentation and issue disposition reflect verified behavior.

**Evidence:** Gate document, issue register, journey recordings/captures, data snapshots, notification logs, full test runs, and docs diff.

**Deliverables:** Stabilized core MVP retention and notification experience.

**Out of scope:** Commercial billing, complete privacy/deletion execution, and App Admin operations.

### Phase 19 — Profile, Privacy, Import/Export & Account Deletion · Not started

**Goal:** Give Users complete control over profile data, portability, privacy rights, and account removal without damaging shared history.

**Dependencies:** Phase 18 stable data model; Phase 17 notifications; legal/retention decisions required before UAT approval.

**Tickets:**

- [19.1 — Approve retention, deletion, export, and legal-copy policy (#64)](https://github.com/Shagon1k/PickFlick/issues/64)
- [19.2 — Implement profile and private avatar management (#65)](https://github.com/Shagon1k/PickFlick/issues/65)
- [19.3 — Deliver safe personal-ratings CSV import and export (#66)](https://github.com/Shagon1k/PickFlick/issues/66)
- [19.4 — Generate private expiring GDPR archive downloads (#67)](https://github.com/Shagon1k/PickFlick/issues/67)
- [19.5 — Implement idempotent account deletion and shared-history anonymization (#68)](https://github.com/Shagon1k/PickFlick/issues/68)
- [19.6 — Publish policy-backed privacy and personal-data surfaces (#69)](https://github.com/Shagon1k/PickFlick/issues/69)

**Scope:**

- [ ] Implement profile display name, avatar upload/remove, email/provider display, and locale-ready settings structure.
- [ ] Implement personal ratings CSV schema, safe parser limits/formula handling, validation preview/result, idempotent import, and CSV export.
- [ ] Implement complete GDPR archive job, private expiring download, manifest, provider/shared-data disclosure, and failure/retry status.
- [ ] Implement re-authenticated account deletion: revoke sessions, cancel/mark billing integration, remove private Library/profile data, anonymize shared Club/Session attribution, and clean objects.
- [ ] Preserve adminless Clubs, disable ownership actions, and notify remaining members when no transfer occurred.
- [ ] Replace provisional prototype privacy/cookie/retention copy with implementation- and review-backed content.

**Acceptance Check:**

- [ ] Upload/import/export/archive actions expose only the requesting User’s authorized data and reject unsafe files/content.
- [ ] Deletion preserves shared history anonymously, revokes access, handles adminless Clubs, and is idempotent/recoverable at job boundaries.
- [ ] Published privacy text matches actual providers, collection, retention, cookies, exports, and deletion behavior.
- [ ] Settings/privacy/import-export surfaces pass responsive/accessibility/destructive-flow checks.

**Evidence:** Privacy data inventory, CSV fixtures/tests, archive inspection, deletion integration test, object cleanup proof, legal/privacy sign-off, and design captures.

**Deliverables:** Profile, personal portability, GDPR archive, approved privacy surface, and account deletion/anonymization workflow.

**Out of scope:** Non-English UI and ownership recovery beyond the approved adminless state.

### Phase 20 — Subscription & Entitlements · Not started

**Goal:** Operate the €5 monthly Pro offer while preserving data through billing state changes.

**Dependencies:** Phase 19 account/privacy hooks; Phase 5 entitlement interfaces; Phase 17 notifications; confirmed Paddle plan/domain configuration.

**Tickets:**

- [20.1 — Resolve downgrade Club selection and confirm Paddle configuration (#70)](https://github.com/Shagon1k/PickFlick/issues/70)
- [20.2 — Deliver Paddle checkout, portal, billing history, and Subscription UI (#71)](https://github.com/Shagon1k/PickFlick/issues/71)
- [20.3 — Process and reconcile Paddle webhooks idempotently (#72)](https://github.com/Shagon1k/PickFlick/issues/72)
- [20.4 — Enforce subscription-derived entitlements and non-destructive downgrade states (#73)](https://github.com/Shagon1k/PickFlick/issues/73)
- [20.5 — Archive and reactivate inactive Clubs using plan grace periods (#74)](https://github.com/Shagon1k/PickFlick/issues/74)

**Scope:**

- [ ] Implement Paddle customer/checkout, success/cancel/failure returns, portal access, and recurring monthly anchor behavior.
- [ ] Implement signed raw-body webhook verification, idempotent BillingEvent ledger, out-of-order reconciliation, and provider-state repair.
- [ ] Replace fixture entitlements with subscription-derived Admin Club/member limits, visibility controls, analytics tier, and inactivity grace.
- [ ] Implement Settings Subscription current plan, usage, billing history, portal, cancellation, and Pricing upgrade handoff.
- [ ] Implement payment failure, renewal, cancellation, downgrade/read-only, reactivation, and non-destructive over-limit behavior.
- [ ] Emit billing notifications through Phase 17 preferences/delivery and integrate deletion cancellation from Phase 19.

**Acceptance Check:**

- [ ] Duplicate/out-of-order/invalid webhooks cannot grant incorrect access or duplicate notification effects.
- [ ] Monthly billing anchor, cancel-at-period-end, payment failure, downgrade, reactivation, and portal state match Paddle sandbox truth.
- [ ] Downgrade/read-only never deletes Club/Session data and has a resolved writable-Club selection policy.
- [ ] Entitlement matrix and subscription/pricing UI pass API/E2E/design checks.

**Evidence:** Paddle sandbox runs, webhook/reconciliation tests, entitlement matrix, billing notification tests, and responsive captures.

**Deliverables:** Commercial monthly Pro vertical slice and live entitlement projection.

**Out of scope:** Annual billing, coupons beyond provider defaults, and native-app purchases.

### Phase 21 — App Admin & Operational Controls · Not started

**Goal:** Let App Admins safely operate Users, Clubs, application settings, metadata, and sensitive actions.

**Dependencies:** Phase 20 billing data; all preceding User/Club/Session modules; Phase 1 observability/audit foundations.

**Tickets:**

- [21.1 — Build the protected App Admin shell, overview, and metrics (#75)](https://github.com/Shagon1k/PickFlick/issues/75)
- [21.2 — Add audited User suspension, reinstatement, and session revocation (#76)](https://github.com/Shagon1k/PickFlick/issues/76)
- [21.3 — Add audited Club ownership transfer and destructive deletion (#77)](https://github.com/Shagon1k/PickFlick/issues/77)
- [21.4 — Add application settings, audit retention, and operational indicators (#78)](https://github.com/Shagon1k/PickFlick/issues/78)

**Scope:**

- [ ] Implement App Admin overview metrics, operational activity, subscription mix, and privacy-safe aggregate queries.
- [ ] Implement User search/filter, suspend/reinstate, session revocation, and status display.
- [ ] Implement Club search/filter, ownership transfer, destructive deletion, and plan/usage visibility.
- [ ] Implement registration/verified-email defaults, maintenance mode, Free member default, TMDB refresh cadence, and audit-retention settings.
- [ ] Implement typed-name confirmations, transfer target validation, idempotent sensitive operations, and AdminAuditEvent records.
- [ ] Wire production health/job/provider indicators needed for operations without introducing a Support app role.

**Acceptance Check:**

- [ ] Normal Users cannot access App Admin routes, APIs, projections, SSE, or actions even with forged requests.
- [ ] Suspend/reinstate/transfer/delete/settings actions are confirmed, authorized, audited, and recover safely on retry/failure.
- [ ] Admin metrics reconcile to canonical data/provider state within documented freshness.
- [ ] Admin desktop/mobile tables, filters, dialogs, and settings pass design/accessibility checks.

**Evidence:** Admin authorization/integration tests, audit records, reconciliation fixtures, sensitive-action E2E, and design captures.

**Deliverables:** App Admin control plane and audited operational actions.

**Out of scope:** Global Support role and arbitrary database-edit tools.

### Phase 22 — PWA & Mobile Installability · Not started

**Goal:** Deliver an installable, online-first PickFlick experience with safe updates and explicit offline behavior.

**Dependencies:** Phase 21 feature-complete UI; Phase 2 responsive shell; chosen service-worker approach/browser matrix.

**Tickets:**

- [22.1 — Select the service-worker strategy and supported browser/device matrix (#79)](https://github.com/Shagon1k/PickFlick/issues/79)
- [22.2 — Add manifest, icons, installability, cache privacy, and safe updates (#80)](https://github.com/Shagon1k/PickFlick/issues/80)
- [22.3 — Complete offline guards and mobile/tablet/standalone behavior (#81)](https://github.com/Shagon1k/PickFlick/issues/81)

**Scope:**

- [ ] Generate final manifest, icons/masks, theme/display metadata, installation affordances, and launch handling from brand sources.
- [ ] Implement an online-first service worker and cache only assets/read-only responses whose privacy/staleness rules are explicit.
- [ ] Implement safe service-worker update discovery/activation without trapping Users on incompatible clients.
- [ ] Disable/reject network-required mutations clearly while offline; never silently queue Nomination/Selection/Rating/billing/privacy operations.
- [ ] Complete touch/mobile/tablet navigation, viewport, safe-area, keyboard, orientation, and standalone-mode behavior across all canonical surfaces.
- [ ] Add install/update/offline/online recovery tests for the approved browser/device matrix.

**Acceptance Check:**

- [ ] Installability and icons/manifest pass approved browser audits and real-device checks.
- [ ] Offline/read-only/update behavior never leaks another User’s cached data or submits stale mutations.
- [ ] Every critical surface remains usable in supported mobile/tablet/standalone modes.
- [ ] Reconnect and service-worker update recovery are understandable and tested.

**Evidence:** PWA audits, real-device recordings/captures, cache/privacy inspection, update tests, and browser matrix.

**Deliverables:** Installable online-first PWA and completed mobile/tablet behavior.

**Out of scope:** Offline writes, background sync mutations, and web push.

### Phase 23 — Security, SEO, Observability & Release Readiness · Not started

**Goal:** Make the feature-complete MVP secure, observable, recoverable, discoverable where public, and ready for final UAT.

**Dependencies:** Phases 19–22; production-like UAT environment and final domain/provider configuration.

**Tickets:**

- [23.1 — Assign release ownership and approve launch-governance evidence (#82)](https://github.com/Shagon1k/PickFlick/issues/82)
- [23.2 — Approve backup retention and regional/account-loss strategy (#83)](https://github.com/Shagon1k/PickFlick/issues/83)
- [23.3 — Approve proxy client identity, abuse, and graceful-drain contracts (#84)](https://github.com/Shagon1k/PickFlick/issues/84)
- [23.4 — Complete threat-model hardening and launch security scans (#85)](https://github.com/Shagon1k/PickFlick/issues/85)
- [23.5 — Complete observability, alerts, dashboards, and operational runbooks (#86)](https://github.com/Shagon1k/PickFlick/issues/86)
- [23.6 — Enforce approved retention schedules and expiring-object cleanup (#87)](https://github.com/Shagon1k/PickFlick/issues/87)
- [23.7 — Prove migrations, backups, restore, rollback, and graceful drain (#88)](https://github.com/Shagon1k/PickFlick/issues/88)
- [23.8 — Verify production brand/media rights and provider attribution (#89)](https://github.com/Shagon1k/PickFlick/issues/89)
- [23.9 — Finalize public SEO, canonical, social, crawler, and PWA release behavior (#90)](https://github.com/Shagon1k/PickFlick/issues/90)
- [23.10 — Pass performance, accessibility, and release-candidate quality budgets (#91)](https://github.com/Shagon1k/PickFlick/issues/91)
- [23.11 — Rehearse the exact release candidate and close release readiness (#92)](https://github.com/Shagon1k/PickFlick/issues/92)

**Scope:**

- [ ] Complete threat-model review, rate limits, headers, proxy/session/CSRF/CORS policies, webhook/upload/export hardening, dependency/secret scanning, and abuse cases.
- [ ] Complete public SEO metadata, structured data, sitemap/robots/canonicals/social previews and authenticated/invite/admin noindex verification.
- [ ] Complete logs/metrics/traces/error monitoring, queue/deadline/webhook/email/export/deletion alerts, health/readiness, dashboards, and runbook links.
- [ ] Finalize production migrations, zero/low-downtime constraints, backups, restore verification, rollback strategy, retention jobs, and disaster/recovery runbooks.
- [ ] Assign the release owner and rollback authority; rehearse an exact release revision through readiness, smoke, graceful drain, and rollback procedures.
- [ ] Decide and verify proxy-derived client identity, edge abuse limits, connection/workload drain, backup destination/retention, and the response to regional or hosting-account loss.
- [ ] Validate the final canonical host, PWA and social/OG assets, robots/sitemap, and external crawler-cache refresh behavior in production-like UAT.
- [ ] Reconcile technically shipped privacy/billing/provider behavior with external legal actions; record whether every remaining item is a launch gate or an owned post-launch follow-up.
- [ ] Run performance/load checks for critical API, SSE, search, worker, aggregate, and admin paths; resolve launch-blocking budgets.
- [ ] Complete privacy/security/content/accessibility launch checklists and close every unresolved launch-critical Decision Log item.

**Acceptance Check:**

- [ ] Security review/scans and critical abuse tests have no unresolved launch-blocking finding.
- [ ] Monitoring/alerts detect controlled failures without collecting unnecessary personal data.
- [ ] Backup restore, migration rehearsal, rollback, graceful drain, and UAT smoke runbooks are demonstrated; regional/account-loss disposition is recorded.
- [ ] Public SEO is correct; private/token/admin data is not indexable; canonical/PWA/OG production-like checks and crawler-cache refresh evidence are captured; performance/accessibility targets pass.
- [ ] Every Pre-MVP Production Readiness item has an owner, evidence, and either a resolved decision or an approved, non-launch-critical follow-up.

**Evidence:** Threat model, scan reports, UAT metrics/dashboards, alert tests, performance results, release-rehearsal revision, restore/rollback/drain logs, crawler-cache checks, legal-action disposition, and launch checklists.

**Deliverables:** Release candidate, operational runbooks, verified observability/security/SEO/recovery baseline.

**Out of scope:** Production traffic cutover and post-MVP features.

### Phase 24 — Human Verification & Bug Fixing IV · Not started

**Goal:** Perform final human UAT and produce an explicit go/no-go release decision.

**Dependencies:** Phases 19–23 complete; production-like UAT with live/sandbox providers as appropriate.

**Tickets:**

- [24.1 — Execute final UAT and issue the MVP Go/No-Go decision (#93)](https://github.com/Shagon1k/PickFlick/issues/93)

**Scope:**

- [ ] Create `_docs/phase-24-human-verification-4.md` with release-candidate identity, environment, data set, owners, and severity-classified issue register.
- [ ] Execute every canonical public/auth/Club/Session/Library/Settings/Billing/Admin/PWA flow across representative roles, devices, and failure states.
- [ ] Verify real OAuth, TMDB, Paddle sandbox, Resend, object storage, worker/deadline, SSE, monitoring, backup/restore, and rollback handoffs.
- [ ] Run the production-like edge/UAT drill through the chosen proxy and verify client identity, abuse handling, graceful drain, external public-crawler behavior, and release/rollback ownership handoffs.
- [ ] Perform final visual parity, long/empty/error/read-only/offline, keyboard/touch, screen-reader, reduced-motion, and browser/device review.
- [ ] Fix every Blocker/Major; permit Minor/Polish deferral only with explicit post-launch ownership and no safety/privacy/billing/accessibility risk.
- [ ] Consolidate staging docs, confirm launch checklists, record the exact remaining risk, and issue go/no-go approval.

**Acceptance Check:**

- [ ] No open Blocker or Major issue remains and no launch-critical decision/checklist item is unresolved.
- [ ] Full CI/E2E/accessibility/PWA/security suites pass on the release candidate after final fixes.
- [ ] Manual UAT evidence covers every canonical screen family, role, integration, and critical recovery path.
- [ ] Product owner records an explicit Go decision for Phase 25.

**Evidence:** Final gate document, issue register, recordings/captures, test/audit runs, provider/operations evidence, and signed go/no-go note.

**Deliverables:** Approved release candidate and traceable final UAT record.

**Out of scope:** Production deployment itself and new feature scope.

### Phase 25 — Production Deploy · Not started

**Goal:** Deploy the approved release candidate safely and verify real production operation.

**Dependencies:** Phase 24 Go decision; production secrets/domains/providers/infrastructure and rollback owners ready.

**Tickets:**

- [25.1 — Provision and verify production providers, secrets, storage, backups, and domains (#94)](https://github.com/Shagon1k/PickFlick/issues/94)
- [25.2 — Deploy the approved MVP revision and complete production verification (#95)](https://github.com/Shagon1k/PickFlick/issues/95)

**Scope:**

- [ ] Provision/verify production configuration, secrets, domains/TLS, OAuth callbacks, Paddle webhooks/product, Resend sender, storage, monitoring, and backup targets.
- [ ] Apply approved database migrations in the rehearsed order and deploy immutable web/API/worker artifacts.
- [ ] Record the release owner, exact deployed revision, readiness decision, and rollback authority before traffic cutover.
- [ ] Run production health, migration, auth, public, Club/Session, billing-safe, job/SSE, storage/email, PWA, SEO/canonical/OG, crawler-cache, and monitoring smoke checks.
- [ ] Verify alert routing, backup destination/schedule, queue/deadline health, webhook receipt, log scrubbing, proxy client identity, abuse limits, graceful drain, and rollback readiness.
- [ ] Monitor the defined launch window, triage production findings, and roll back or forward-fix according to runbook thresholds.
- [ ] Record deployment evidence, release revision, production verification, remaining risks, and Roadmap/Architecture operational state.

**Acceptance Check:**

- [ ] Production serves the approved exact revision and critical smoke checks pass with no data/privacy/billing regression.
- [ ] Monitoring, alerts, backups, jobs, webhooks, and provider integrations show healthy real operation.
- [ ] Rollback remains executable and launch-window Blocker/Major findings are resolved or trigger rollback.
- [ ] Guidance accurately distinguishes Active production behavior from remaining Proposed/deferred work.

**Evidence:** Deployment/migration logs, release revision, smoke output, monitoring/alert/backup evidence, provider checks, and launch report.

**Deliverables:** Production PickFlick MVP and verified operational handoff.

**Out of scope:** Post-MVP backlog delivery.

## 12. Decision Log

### Resolved Decisions

| Decision | Owner | Resolution | Evidence |
| --- | --- | --- | --- |
| Canonical UAT and production domains | Product owner | Use `https://uat.pick-flick.app` for UAT and `https://pick-flick.app` for production. Do not introduce alternative application-environment aliases. | Developer decision, 2026-08-24. |
| Selection scale start | Product owner | New Clubs use `0..N` with one slider for N (1–10), matching the canonical Create Club design. The `0|1` start remains accepted by the data model, API, and stored Clubs, so nothing is migrated; tightening the schema needs a separate reviewed migration. | Phase 6 human verification, 2026-09-24. |
| Product navigation density | Product owner | The mobile Hub strip lists Club views only (My Library is its own tab). The Settings strip and account menu keep Profile, Notifications, Subscription, Privacy, and Sign out, plus Admin Panel for App Admins. Contact stays in the site footer. Pricing is reached from the public header and, later, Subscription. Manage Club stays visible to every member because it carries Leave Club and a read-only view. | Phase 6 human verification, 2026-09-24. |
| Public marketing navigation | Product owner | Public pages use a header with How it works, Features, and Pricing plus a secondary Go to App entry, and no mobile bottom menu. Below 821px only Pricing and Go to App stay in the header. Contact, Privacy, and Terms move to a wordmark-and-tagline footer. | Phase 6 human verification, 2026-09-24. |
| Proportional MVP deployment baseline | Developer | Use Dokploy-managed PostgreSQL/Redis and one application Compose resource per environment; trace source-built UAT by full revision, then require UAT-proven digest promotion before production. | [ADR-007](_docs/decisions/README.md#adr-007--use-a-proportional-dokploy-deployment-baseline), 2026-09-07. |
| Source-built production promotion | Developer | For the current single-host MVP, promote only current `main` with exact successful UAT evidence by pinning production to an immutable SemVer tag. Keep production disabled by default and defer digest publication until separate build/deployment hosts or another artifact-identity requirement. | [ADR-008](_docs/decisions/README.md#adr-008--promote-source-built-production-from-uat-proven-semver-tags), 2026-09-11. |
| Production contact and email sender identity | Product owner | Publish `hello@pick-flick.app`; send production email as `PickFlick <notifications@pick-flick.app>` and UAT email as `PickFlick UAT <notifications@uat.pick-flick.app>`. Google Workspace receives public mail, Resend sends application mail, Cloudflare owns DNS, and Alex controls all three providers. | [ADR-009](_docs/decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders), 2026-09-13. |
| Authentication and account linking | Developer | Run Better Auth inside the NestJS API with database-backed opaque sessions. Identify external accounts by provider subject, disable implicit email linking, and require an explicit fresh-session flow to link Google or Apple identities. Next.js remains presentation rather than session authority. | [ADR-010](_docs/decisions/README.md#adr-010--use-better-auth-at-the-api-boundary), 2026-09-16. |
| Apple Sign In activation | Product owner | Retain the reviewed Apple implementation but keep it disabled in every deployed environment. Activation requires separate owner approval for Apple Developer Program membership, real provider configuration, and sandbox/UAT verification. | Issue #27 review decision, 2026-09-17. |

### Open Questions

These do not block guidance creation; each has an explicit decision point.

| Question | Owner | Needed by | Next check |
| --- | --- | --- | --- |
| Which administered Club remains writable when a Pro user with several Clubs downgrades to Free? | Product owner | Phase 20 | Design the downgrade choice/default before Paddle entitlement implementation. |
| How will external crawler caches be refreshed after production cutover? | Product owner | Phase 23 | Define and rehearse the cache-refresh procedure before final production metadata validation. |
| What exact deletion, export-artifact, audit, inactive-data, and backup retention periods are legally approved, and which external legal actions are launch gates versus owned post-launch follow-ups? | Product owner + legal/privacy reviewer | Phase 19 / 23 | Reconcile technically shipped behavior, backup policy, published privacy copy, and legal disposition before release readiness. |
| Which PWA service-worker approach and supported browser/device matrix will be maintained? | Developer + implementation agent | Phase 1 / 22 | Verify current framework compatibility during foundation work and finalize before PWA implementation. |
| Who is the release owner and rollback authority, and what exact revision/readiness/smoke evidence is required before and after production cutover? | Product owner + release owner | Phase 23 / 25 | Assign the owner and accept the release runbook before the Phase 23 rehearsal. |
| What are the production backup destination, restore target, and regional or hosting-account-loss strategy? | Product owner + infrastructure owner | Phase 23 | Approve the deployment/operations ADR, then complete the restore and disaster-recovery drill. |
| Which proxy configuration establishes trustworthy client identity, abuse limits, and graceful drain behavior? | Infrastructure owner + developer | Phase 23 | Decide with the final deployment topology and verify in the production-like UAT drill. |

### Deferred Decisions & Tech Debt

| # | Item | Context | Current stance | Revisit trigger |
| --- | --- | --- | --- | --- |
| 1 | Recalculate personal movie ratings from history across all Clubs | MVP keeps historical Session Ratings separate from one editable Personal Rating. | A new Session Rating updates the current Personal Rating; later edits do not rewrite history. | Users need computed averages, per-viewing trends, or a “rebuild from history” action. |
| 2 | Adminless Club recovery | Account deletion can leave a Club with no Admin and members are notified. | Preserve history and disable owner-only operations. | First real occurrence, support burden, or ownership-recovery feature planning. |
| 3 | Recommendation algorithm | Movie Details requires “You may also like.” | Use TMDB/provider-related titles with deterministic fallback. | AI recommendation phase begins or provider quality is insufficient. |
| 4 | Annual billing | Admin prototype includes annual fixture data but initial offer is monthly. | Do not implement annual plans. | Commercial validation supports an annual offer. |
| 5 | Offline mutation model | Online-first PWA is sufficient for MVP. | Reject/disable network-required actions with clear recovery; never silently queue them. | Field usage demonstrates meaningful offline demand. |
| 6 | Localization | Settings prototype mentions Russian later. | Externalize copy and formats but ship English only. | Russian implementation is scheduled. |
| 7 | Legal/privacy prototype copy | Prototype includes unapproved numeric and “no cookie banner” claims. | Treat as design copy, not policy truth. | Pre-launch privacy/legal review. |

## 13. Post-MVP Backlog

| Item | Value | Dependencies | Priority |
| --- | --- | --- | --- |
| AI watch-history analysis | Personal trends and deeper retention insight. | Sufficient history, consent/privacy design, evaluation, inference cost controls. | High |
| Personal rating recomputation/history views | Lets users understand changing opinions across repeated screenings. | Stable Session/Personal Rating model. | High |
| Personalized AI recommendations | More relevant discovery than provider-related titles. | History quality, AI evaluation, privacy and cost controls. | Medium |
| AI-enhanced Club analytics | Adds optional assisted insight after deterministic Club analytics prove useful. | Stable deterministic analytics, privacy design, evaluation, and cost controls. | Medium |
| Club rating CSV export | Portable Club analysis. | Export authorization and privacy policy. | Medium |
| Russian localization | Expands accessibility for intended users. | Externalized strings and locale QA. | Medium |
| Web push | Timelier phase participation. | PWA permission strategy and notification reliability. | Medium |
| Offline writes | Use during poor-connectivity movie nights. | Conflict-resolution and stale-phase protocol. | Low |
| Annual Pro plan | Lower churn and commercial flexibility. | Monthly plan validation and Paddle pricing design. | Low |
| Adminless Club ownership recovery | Restores owner-only operations without corrupting shared history. | Real support evidence and an approved identity/ownership recovery policy. | Low |

### Owning tickets

- [PM.1 — Define the privacy-safe AI watch-history analysis MVP (#96)](https://github.com/Shagon1k/PickFlick/issues/96)
- [PM.2 — Define personal rating recomputation and repeated-viewing history (#97)](https://github.com/Shagon1k/PickFlick/issues/97)
- [PM.3 — Define personalized Movie recommendations beyond TMDB related titles (#98)](https://github.com/Shagon1k/PickFlick/issues/98)
- [PM.4 — Define AI-enhanced Club analytics after deterministic analytics mature (#99)](https://github.com/Shagon1k/PickFlick/issues/99)
- [PM.5 — Export Club ratings as CSV (#100)](https://github.com/Shagon1k/PickFlick/issues/100)
- [PM.6 — Add Russian localization (#101)](https://github.com/Shagon1k/PickFlick/issues/101)
- [PM.7 — Define web push rollout and permission strategy (#102)](https://github.com/Shagon1k/PickFlick/issues/102)
- [PM.8 — Define a safe offline-write and conflict-resolution model (#103)](https://github.com/Shagon1k/PickFlick/issues/103)
- [PM.9 — Add annual Pro billing after commercial validation (#104)](https://github.com/Shagon1k/PickFlick/issues/104)
- [PM.10 — Define adminless Club ownership recovery (#105)](https://github.com/Shagon1k/PickFlick/issues/105)

## 14. Progress Tracking

| Phase | Status | Evidence | Notes |
| --- | --- | --- | --- |
| 0 — Guidance Baseline | Done | Guidance validator, prototype-link scan, JSON checks, 24-asset manifest/dimension check, and cleanup checks passed on 2026-07-22. | No application code was created. |
| 1 — Infrastructure, Repository & Deployment Foundation | Not started |  | First implementation phase; create the active phase document before coding. |
| 2 — Production Design System & App Shells | In progress | [Active Phase 2 plan](_docs/phase-2-production-design-system.md) | Issue #17 implements the production foundations; preview review remains required. |
| 3 — Public Site & System States | In progress | [Active Phase 3 plan](_docs/phase-3-public-site-system-states.md) and [ADR-009](_docs/decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders) | Contact/email identity is approved; Landing, Pricing, Contact, provisional legal entry, indexing boundaries, and recovery surfaces are implemented and locally verified. Required exact-SHA visual acknowledgements remain. |
| 4 — Authentication & Account Onboarding | In progress | [Active Phase 4 plan](_docs/phase-4-authentication-account-onboarding.md) and [ADR-010](_docs/decisions/README.md#adr-010--use-better-auth-at-the-api-boundary) | The auth/session implementation and account-linking contract are approved. Google and protected-boundary authorization are active locally; Apple is implemented but dormant behind the owner-controlled provisioning gate. Owner provider runs remain. |
| 5 — Clubs, Membership & Roles | Not started |  |  |
| 6 — Human Verification & Bug Fixing I | Not started |  | Stabilization gate for Phases 1–5. |
| 7 — Club Hub & Club Invitations | Not started |  |  |
| 8 — Movie Catalog, TMDB & Global Search | Not started |  |  |
| 9 — Session Creation & Participant Roster | Not started |  |  |
| 10 — Nomination & Deadline Automation | Not started |  |  |
| 11 — Selection & Winner Resolution | Not started |  |  |
| 12 — Human Verification & Bug Fixing II | Not started |  | Stabilization gate for Phases 7–11. |
| 13 — Watching, Rating & Completion | Not started |  | Completes the live core loop. |
| 14 — Past Sessions & Shared History | Not started |  |  |
| 15 — Personal Library, Ratings & Watchlist | Not started |  |  |
| 16 — Club/Personal Statistics & Achievements | Not started |  |  |
| 17 — Notifications & Preferences | Not started |  |  |
| 18 — Human Verification & Bug Fixing III | Not started |  | Stabilization gate for Phases 13–17. |
| 19 — Profile, Privacy, Import/Export & Account Deletion | Not started |  |  |
| 20 — Subscription & Entitlements | Not started |  |  |
| 21 — App Admin & Operational Controls | Not started |  |  |
| 22 — PWA & Mobile Installability | Not started |  |  |
| 23 — Security, SEO, Observability & Release Readiness | Not started |  | Produces the release candidate. |
| 24 — Human Verification & Bug Fixing IV | Not started |  | Final UAT and explicit go/no-go gate. |
| 25 — Production Deploy | Not started |  | Requires Phase 24 Go decision. |

Status: `Not started` · `In progress` · `Done` · `Blocked` · `Needs approval`
