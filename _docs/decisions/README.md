# PickFlick Architecture Decision Records

> Durable record of significant technical decisions and why they were made.
> [ARCHITECTURE.md](../../ARCHITECTURE.md) describes the proposed/current system; [ROADMAP.md](../../ROADMAP.md) owns unresolved and deferred work.

## Statuses

| Status | Meaning |
| --- | --- |
| `Proposed` | A concrete decision is under review and is not current direction. |
| `Accepted` | The developer approved the decision; it is current direction. |
| `Rejected` | A concrete proposal was declined; rationale is preserved. |
| `Superseded` | A later ADR replaces an accepted decision and links both records. |

An accepted ADR approves direction. It does not make unimplemented code, configuration, or
infrastructure `Active`; [ARCHITECTURE.md](../../ARCHITECTURE.md) records implementation state
separately.

## Registry

| ID | Decision | Status | Date |
| --- | --- | --- | --- |
| [ADR-001](#adr-001--use-a-pnpm-modular-monorepo-with-three-runtime-entrypoints) | Use a pnpm modular monorepo with three runtime entrypoints | Accepted | 2026-09-05 |
| [ADR-002](#adr-002--keep-authentication-and-sessions-at-the-api-boundary) | Keep authentication and sessions at the API boundary | Accepted | 2026-09-05 |
| [ADR-003](#adr-003--use-postgresql-and-reviewed-prisma-migrations) | Use PostgreSQL and reviewed Prisma migrations | Accepted | 2026-09-05 |
| [ADR-004](#adr-004--use-bullmq-with-a-transactional-outbox) | Use BullMQ with a transactional outbox | Accepted | 2026-09-05 |
| [ADR-005](#adr-005--deploy-immutable-images-through-isolated-dokploy-environments) | Deploy immutable images through isolated Dokploy environments | Accepted | 2026-09-05 |
| [ADR-006](#adr-006--own-projector-noir-and-use-mantine-selectively) | Own Projector Noir and use Mantine selectively | Accepted | 2026-09-05 |

Never reuse or renumber an ID. Never rewrite accepted history to hide a changed decision; append a
superseding ADR and link both records.

## ADR-001 — Use a pnpm modular monorepo with three runtime entrypoints

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decider:** Developer
- **Owning issue:** [#9](https://github.com/Shagon1k/PickFlick/issues/9)

### Context

PickFlick needs a public/authenticated Next.js application, a server-enforced API boundary, and
durable background work. Contracts, domain vocabulary, database migrations, configuration, and UI
tokens must change atomically. Expected MVP scale does not justify microservice deployment or
separate repositories.

pnpm supports a workspace rooted by `pnpm-workspace.yaml`; the `workspace:` protocol prevents an
internal dependency from resolving to a registry package. Next.js supports full-featured Node and
Docker self-hosting, and NestJS supports Redis-backed BullMQ consumers in separate processes.

### Decision

Use one TypeScript pnpm workspace with:

- `apps/web` for Next.js App Router routes, rendering, and browser interaction;
- `apps/api` for NestJS REST, OAuth/session callbacks, SSE, webhooks, and synchronous commands;
- `apps/worker` for BullMQ consumers, deadline reconciliation, and retryable work;
- focused packages for generated contracts, database access/migrations, UI, and configuration.

Treat the system as a modular monolith with three runtime entrypoints. Keep module ownership explicit
inside the API and worker. Extract server-side domain/application code into a focused package only
when both entrypoints need it; do not import one application entrypoint from another or create a
generic `shared` dumping ground. Use `workspace:` for internal dependencies and reject workspace
dependency cycles.

### Consequences

- One change can update schema, API contract, client, worker, and documentation atomically.
- Web, API, and worker failures and scaling remain independently operable.
- Local development and deployment must orchestrate three processes and their dependencies.
- Cross-entrypoint behavior needs an explicit shared boundary when the second consumer appears.

### Alternatives considered

- **One Next.js full-stack process — rejected.** It reduces initial deployment count but combines
  UI rendering, provider callbacks, authorization, and long-running work in one failure boundary.
- **Microservices — rejected.** Network contracts and distributed operations add cost without an
  MVP scale or team requirement.
- **Separate repositories — rejected.** They make atomic schema and generated-contract changes
  harder without providing useful isolation at this stage.

### Verification

Issue #10 must prove workspace-local resolution, cycle rejection, independent web/API/worker
builds and starts, and no unused generated packages. Until then, the implementation remains
`Proposed`.

### Evidence

- [pnpm workspaces](https://pnpm.io/workspaces)
- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [NestJS queues](https://docs.nestjs.com/techniques/queues)

## ADR-002 — Keep authentication and sessions at the API boundary

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decider:** Developer
- **Owning issue:** [#9](https://github.com/Shagon1k/PickFlick/issues/9)

### Context

PickFlick permits registered Google and Apple users only. The API must enforce global and Club roles
for HTTP, SSE, files, provider callbacks, and administrative actions. Splitting authentication from
authorization or exposing bearer credentials to browser JavaScript would weaken this boundary.

### Decision

Expose web and API routes through one public origin. Route `/api/*` to NestJS and other application
routes to Next.js. The API owns OAuth callbacks, identity linking, server sessions, revocation, and
authorization.

Give the browser only an opaque, high-entropy session identifier in a host-only cookie. Production
cookies use the `__Host-` prefix, `Secure`, `HttpOnly`, `Path=/`, and an explicitly tested `SameSite`
policy compatible with Google and Apple return flows. Never put session identifiers, OAuth tokens,
roles, or permissions in browser storage. Store session meaning and provider credentials server-side.

Protect state-changing requests with an explicit CSRF mechanism plus Origin validation; `SameSite`
is defense in depth. Deny cross-origin browser access unless a later accepted decision names a
specific origin and need. Rotate the session after authentication and privilege changes. Revoke all
sessions on suspension or account deletion. Re-authorize every query, mutation, SSE connection,
upload/download URL, webhook-management action, and admin operation at the API/data boundary.

This ADR fixes the boundary, not the library. Issue
[#25](https://github.com/Shagon1k/PickFlick/issues/25) will compare maintained auth/session libraries
and accept the implementation choice before Phase 4 authentication work.

### Consequences

- Browser JavaScript cannot read the session identifier.
- One server boundary owns session and authorization policy.
- Cookie authentication requires deliberate CSRF, proxy, and OAuth-return testing.
- The exact library remains open without blocking repository scaffolding.

### Alternatives considered

- **JWT access and refresh tokens in browser storage — rejected.** They expand credential exposure
  to injected JavaScript and make immediate central revocation harder.
- **Next.js-owned authentication with NestJS-owned authorization — rejected.** It splits session
  lifecycle and trust across two server boundaries.
- **Select an auth library in Phase 1 — rejected.** Scaffolding needs a stable boundary, while issue
  #25 owns provider/library maintenance, account-linking behavior, and implementation proof.

### Verification

Issue #10 must reserve the same-origin route boundary without implementing authentication. Issues
#25–#28 must prove cookie flags, OAuth return flows, CSRF rejection, rotation/revocation, and
authorization at every protected boundary. Until then, the implementation remains `Proposed`.

### Evidence

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## ADR-003 — Use PostgreSQL and reviewed Prisma migrations

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decider:** Developer
- **Owning issue:** [#9](https://github.com/Shagon1k/PickFlick/issues/9)

### Context

PickFlick depends on relational constraints, serialized Session transitions, durable audit/provider
state, and reporting. Several high-risk invariants need PostgreSQL constraints that may not have a
stable declarative Prisma representation.

### Decision

Use PostgreSQL as the authoritative domain store and Prisma for the typed client and migration
workflow. Select and pin an exact stable Prisma version during issue #10; do not freeze versions in
planning prose.

Commit the Prisma schema and every SQL migration. Use `migrate dev` only with disposable developer
databases. Create migrations with `--create-only` when SQL needs review or extension, then edit the
SQL before application. Use `migrate deploy` against fresh CI databases, UAT, and production. Never
use `db push` as an environment deployment mechanism.

Implement high-risk invariants in PostgreSQL as well as application code. In particular, use a
reviewed partial unique index for at most one Nomination, Selection, or Watching Session per Club;
do not make this invariant depend on a Prisma preview feature. Restrict destructive reset commands
to positively identified local/test databases. Use expand/contract migrations when the previous
application image must remain rollback-compatible, and use forward fixes when data changes cannot
be reversed safely.

### Consequences

- Schema history and database-specific constraints remain reviewable.
- Application types cover ordinary access while PostgreSQL enforces concurrency-critical rules.
- Developers must inspect generated SQL and maintain deliberate database-specific migrations.
- Image rollback is conditional on migration compatibility, not assumed.

### Alternatives considered

- **Prisma schema with `db push` — rejected.** It does not provide the reviewed production migration
  history required for rollback and auditability.
- **Application-only invariant checks — rejected.** Concurrent transactions can bypass preflight
  checks that are not backed by serialization or constraints.
- **SQL-only data access — rejected.** It adds handwritten mapping and contract cost without a
  current requirement that Prisma cannot meet.

### Verification

Issue #11 must prove fresh migration, upgrade migration, partial-index behavior, isolated
local/test reset, deterministic seed behavior, and schema-compatible rollback rules. Until then,
the implementation remains `Proposed`.

### Evidence

- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- [Customizing Prisma migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations)

## ADR-004 — Use BullMQ with a transactional outbox

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decider:** Developer
- **Owning issue:** [#9](https://github.com/Shagon1k/PickFlick/issues/9)

### Context

Session deadlines, notifications, exports, metadata refresh, email delivery, and webhook follow-up
must survive process restarts. A database transaction cannot atomically commit both PostgreSQL
domain data and a Redis job, so direct enqueueing creates a dual-write failure window.

### Decision

Write domain changes and outbox events in one PostgreSQL transaction. A dispatcher publishes pending
events to BullMQ with stable event/job identifiers and records dispatch progress. Treat dispatch and
job execution as at least once: every consumer and external side effect must be idempotent.

Use Redis/BullMQ for delayed execution, retries, concurrency control, and job visibility. Redis is
never the sole source of domain truth. A worker reloads PostgreSQL state before acting and rejects a
stale deadline job by checking the Session phase, deadline, and version. A periodic reconciliation
job repairs missed overdue Sessions and undispatched outbox events. Use bounded retries/backoff,
classify permanent failures, retain observable failure state, and drain active work during graceful
shutdown.

### Consequences

- A committed domain transition cannot silently lose its delivery intent.
- Duplicate dispatch or execution is safe by contract rather than denied by an exactly-once claim.
- The system gains an outbox table, dispatcher, reconciliation, and idempotency records.
- Queue health and reconciliation lag become operational signals.

### Alternatives considered

- **Enqueue after database commit — rejected.** A crash after commit but before enqueue loses work.
- **Enqueue before database commit — rejected.** A worker can observe work for a transaction that
  later fails.
- **Use the database as the only queue — rejected.** It avoids Redis but requires custom delayed
  scheduling, retry, concurrency, and operational tooling for all workloads.
- **Exactly-once delivery — rejected as a guarantee.** Redis, process crashes, and external
  providers leave duplicate-execution windows.

### Verification

Later domain/worker issues must inject failures at each database-to-queue boundary, prove duplicate
delivery is harmless, prove stale deadlines no-op, and prove reconciliation repairs lost dispatch.
Until then, the implementation remains `Proposed`.

### Evidence

- [NestJS BullMQ integration](https://docs.nestjs.com/techniques/queues)
- [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)

## ADR-005 — Deploy immutable images through isolated Dokploy environments

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decider:** Developer
- **Owning issue:** [#9](https://github.com/Shagon1k/PickFlick/issues/9)

### Context

Every later slice needs a production-shaped UAT path, while production deployment must remain
disabled until a human Go decision. UAT and production must not share data, service identities, or
private networks. The tested artifact must be the artifact promoted.

### Decision

Build immutable web, API, worker, and one-shot release/migration images. Promote the same content
digest between environments; never rebuild a release for production. Maintain one Compose topology
whose environment-specific values come from typed configuration and secret stores.

Use one Dokploy control plane with separate UAT and production projects and, by default, separate
deployment servers. Each environment has distinct networks, credentials, PostgreSQL, Redis, volumes,
and S3-compatible storage scopes. Use Dokploy isolated deployments and native domain routing, and
inspect the rendered Compose definition in verification. Application and data-service ports are not
published to the host. Only the Dokploy/Traefik ingress accepts origin web traffic.

Use Cloudflare-proxied DNS in front of Traefik for `uat.pick-flick.app` and `pick-flick.app`.
Configure the origin so only the intended proxy path reaches Traefik. Trust Cloudflare/forwarded
client-address headers only from the configured proxy chain. Keep Cloudflare Tunnel as a future
hardening option rather than an initial dependency.

Run migration and required seed work as a one-shot release gate before activating a revision. A
failed release job leaves the prior revision active. Deploy a green `main` revision automatically
to UAT and verify the exact digest through health and browser smoke checks. Keep production
promotion manual and inoperative while an explicit production-enable guard is false.

Self-host PostgreSQL and Redis per environment for the initial Dokploy baseline. Require encrypted
off-host PostgreSQL backups and a successful restore exercise before production launch. Keep binary
storage behind the S3 interface and choose its concrete provider during the owning infrastructure
work; use separate buckets/credentials in every environment.

### Consequences

- UAT cannot address production services through Compose networking or shared credentials.
- Production uses the artifact already exercised in UAT.
- Separate deployment servers cost more than logical separation on one host but avoid shared host
  failure and resource contention.
- Self-hosted PostgreSQL/Redis require backup, restore, upgrade, and monitoring ownership.
- Proxy identity, SSE buffering, graceful drain, and origin restrictions require real UAT drills.

### Alternatives considered

- **One Compose project for UAT and production — rejected.** Naming or configuration mistakes can
  cross the environment boundary.
- **Rebuild per environment — rejected.** Production would run an artifact that UAT did not test.
- **Publish application/data ports — rejected.** It bypasses the intended ingress boundary and
  expands exposure.
- **Cloudflare Tunnel initially — rejected.** It can remove inbound origin ports, but adds a
  required daemon and different client-IP behavior before the simpler proxy path is proven.
- **Automatic production deployment from `main` — rejected.** It conflicts with the human
  Go/No-Go and explicit production-enable guard.

### Verification

Issues #13–#16 must prove image identity, rendered Compose isolation, migration failure gating,
private service exposure, exact UAT revision, rollback compatibility, proxy/SSE behavior, and the
disabled production guard. Until then, the implementation and environments remain `Proposed`.

### Evidence

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Dokploy isolated deployments](https://docs.dokploy.com/docs/core/docker-compose/utilities)
- [Dokploy Compose domains](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Cloudflare reverse proxy](https://developers.cloudflare.com/fundamentals/concepts/how-cloudflare-works/)

## ADR-006 — Own Projector Noir and use Mantine selectively

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decider:** Developer
- **Owning issue:** [#9](https://github.com/Shagon1k/PickFlick/issues/9)

### Context

PickFlick has a detailed, bespoke Projector Noir design contract. It also needs accessible dialogs,
menus, popovers, comboboxes, tabs, ratings, and responsive controls. Adopting a library's default
visual system would conflict with the canonical design; rebuilding every behavior-heavy primitive
would add accessibility risk.

### Decision

Own semantic design tokens as project CSS custom properties in `packages/ui`. Use CSS Modules for
component styles and native semantic HTML where it provides the required behavior. Use Mantine only
for reviewed behavior-heavy primitives where its focus, keyboard, overlay, or input behavior saves
material work.

Wrap every approved Mantine primitive in `packages/ui`; feature code must not import Mantine
directly. Map Projector Noir tokens into the Mantine adapter rather than treating Mantine defaults as
product tokens. Import only required styles where practical and define deterministic CSS layer/order
rules for Next.js. Verify semantic names, keyboard operation, visible focus, dialog focus trap/return,
44px touch targets, reduced motion, and contrast for every wrapper.

Use URL/server state first, local React state second, and TanStack Query for API server state. Add
Zustand only after a demonstrated cross-route client-state requirement.

### Consequences

- Projector Noir remains portable and independent of Mantine's default theme.
- Accessible complex primitives do not need to be rebuilt from scratch.
- Wrappers constrain library coupling but require maintenance and focused accessibility tests.
- A feature that needs an unwrapped Mantine component must extend `packages/ui` deliberately.

### Alternatives considered

- **Adopt Mantine's full visual system — rejected.** Its defaults would become a competing design
  authority and make the bespoke interface harder to keep consistent.
- **Build every primitive from scratch — rejected.** Complex focus, keyboard, portal, and overlay
  behavior would consume time and increase accessibility risk.
- **Add a second headless primitive suite — rejected.** It duplicates behavior and styling
  concepts without a demonstrated gap.

### Verification

Issues #17–#19 must inventory direct imports, test each wrapper's interaction/accessibility states,
compare required viewports with the canonical prototypes, and prove Mantine defaults do not leak
into product styling. Until then, UI implementation remains `Proposed`.

### Evidence

- [Mantine with Next.js](https://mantine.dev/guides/next/)
- [Mantine CSS Modules](https://mantine.dev/styles/css-modules/)
- [Mantine style ordering](https://mantine.dev/styles/mantine-styles/)
