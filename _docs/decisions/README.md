# PickFlick Architecture Decision Records

> Durable record of significant technical decisions and why they were made.
> [ARCHITECTURE.md](../../ARCHITECTURE.md) describes the proposed/current system; [ROADMAP.md](../../ROADMAP.md) owns unresolved and deferred work.

## Statuses

| Status       | Meaning                                                           |
| ------------ | ----------------------------------------------------------------- |
| `Proposed`   | A concrete decision is under review and is not current direction. |
| `Accepted`   | The developer approved the decision; it is current direction.     |
| `Rejected`   | A concrete proposal was declined; rationale is preserved.         |
| `Superseded` | A later ADR replaces an accepted decision and links both records. |

An accepted ADR approves direction. It does not make unimplemented code, configuration, or
infrastructure `Active`; [ARCHITECTURE.md](../../ARCHITECTURE.md) records implementation state
separately.

## Registry

| ID                                                                                  | Decision                                                       | Status                                                                                | Date       |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| [ADR-001](#adr-001--use-a-pnpm-modular-monorepo-with-three-runtime-entrypoints)     | Use a pnpm modular monorepo with three runtime entrypoints     | Superseded by [ADR-014](#adr-014--run-two-entrypoints-until-the-first-background-job) | 2026-09-05 |
| [ADR-002](#adr-002--keep-authentication-and-sessions-at-the-api-boundary)           | Keep authentication and sessions at the API boundary           | Accepted                                                                              | 2026-09-05 |
| [ADR-003](#adr-003--use-postgresql-and-reviewed-prisma-migrations)                  | Use PostgreSQL and reviewed Prisma migrations                  | Accepted                                                                              | 2026-09-05 |
| [ADR-004](#adr-004--use-bullmq-with-a-transactional-outbox)                         | Use BullMQ with a transactional outbox                         | Superseded by [ADR-014](#adr-014--run-two-entrypoints-until-the-first-background-job) | 2026-09-05 |
| [ADR-005](#adr-005--deploy-immutable-images-through-isolated-dokploy-environments)  | Deploy immutable images through isolated Dokploy environments  | Superseded by [ADR-007](#adr-007--use-a-proportional-dokploy-deployment-baseline)     | 2026-09-05 |
| [ADR-006](#adr-006--own-projector-noir-and-use-mantine-selectively)                 | Own Projector Noir and use Mantine selectively                 | Superseded by [ADR-013](#adr-013--keep-the-ui-kit-in-the-web-app-on-unstyled-mantine) | 2026-09-05 |
| [ADR-007](#adr-007--use-a-proportional-dokploy-deployment-baseline)                 | Use a proportional Dokploy deployment baseline                 | Accepted                                                                              | 2026-09-07 |
| [ADR-008](#adr-008--promote-source-built-production-from-uat-proven-semver-tags)    | Promote source-built production from UAT-proven SemVer tags    | Accepted                                                                              | 2026-09-11 |
| [ADR-009](#adr-009--use-one-public-contact-and-environment-specific-resend-senders) | Use one public contact and environment-specific Resend senders | Accepted                                                                              | 2026-09-13 |
| [ADR-010](#adr-010--use-better-auth-at-the-api-boundary)                            | Use Better Auth at the API boundary                            | Accepted                                                                              | 2026-09-16 |
| [ADR-011](#adr-011--organize-the-api-by-feature-module-with-one-database-client)    | Organize the API by feature module with one database client    | Accepted                                                                              | 2026-09-18 |
| [ADR-012](#adr-012--validate-boundaries-with-shared-zod-schemas)                    | Validate boundaries with shared zod schemas                    | Accepted                                                                              | 2026-09-26 |
| [ADR-013](#adr-013--keep-the-ui-kit-in-the-web-app-on-unstyled-mantine)             | Keep the UI kit in the web app on unstyled Mantine             | Accepted                                                                              | 2026-09-26 |
| [ADR-014](#adr-014--run-two-entrypoints-until-the-first-background-job)             | Run two entrypoints until the first background job             | Accepted                                                                              | 2026-09-26 |
| [ADR-015](#adr-015--send-a-nonce-based-csp-and-security-headers-from-each-runtime)  | Send a nonce-based CSP and security headers from each runtime  | Accepted                                                                              | 2026-09-26 |
| [ADR-016](#adr-016--use-a-postgresql-queue-for-movie-refresh)                       | Use a PostgreSQL queue for Movie refresh                       | Proposed — developer queue checkpoint pending                                         | 2026-10-09 |

| [ADR-017](#adr-017--keep-movie-identity-independent-of-catalog-sources) | Keep Movie identity independent of catalog sources | Accepted — developer request in PR #160; amended in #172 | 2026-10-09 |
| [ADR-018](#adr-018--persist-nomination-deadline-jobs-in-postgresql) | Persist Nomination deadline jobs in PostgreSQL | Accepted — implemented for #43 on 2026-10-13; amended in #172 | 2026-10-12 |

| [ADR-019](#adr-019--distribute-notification-invalidation-through-redis-pubsub) | Distribute notification invalidation through Redis Pub/Sub | Accepted — owner approval in PR #197 | 2026-10-27 |

Never reuse or renumber an ID. Never rewrite accepted history to hide a changed decision; append a
superseding ADR and link both records.

Earlier ADRs use the command names from before Phase 6 (`pnpm compose:check`, `pnpm deploy:compose`,
`pnpm e2e:smoke`, `pnpm ui:test`); they are now `deploy:check`, `deploy:uat`, `test:e2e`, and
`test:ui`. [AGENTS.md](../../AGENTS.md#commands) lists the current commands.

## ADR-001 — Use a pnpm modular monorepo with three runtime entrypoints

- **Status:** Superseded by [ADR-014](#adr-014--run-two-entrypoints-until-the-first-background-job)
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

- **Status:** Superseded by [ADR-014](#adr-014--run-two-entrypoints-until-the-first-background-job)
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

- **Status:** Superseded by [ADR-007](#adr-007--use-a-proportional-dokploy-deployment-baseline)
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

- **Status:** Superseded by [ADR-013](#adr-013--keep-the-ui-kit-in-the-web-app-on-unstyled-mantine)
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

## ADR-007 — Use a proportional Dokploy deployment baseline

- **Status:** Accepted
- **Date:** 2026-09-07
- **Decider:** Developer
- **Owning issue:** [#112](https://github.com/Shagon1k/PickFlick/issues/112)
- **Supersedes:** [ADR-005](#adr-005--deploy-immutable-images-through-isolated-dokploy-environments)

### Context

Issue #13 proved four production-oriented images, an ordered release gate, health checks, private
ports, container hardening, and a UAT/production Compose render. It also put PostgreSQL and Redis
inside application Compose, required six digest-qualified images before a registry publisher
existed, added a worker egress bridge without an enforcing firewall or allowlist, and coupled
deployment to a repository-owned two-command convergence script.

Dokploy already manages PostgreSQL and Redis as environment services, supplies private internal
connection URLs, schedules database backups, and supports isolated Compose applications. The
production TailorTales deployment shows the smaller operating model in practice: Dokploy-managed
data services, one application Compose resource per environment, a one-shot release service,
health-gated startup, environment-specific aliases, source-revision deployment, UAT browser smoke,
and manual production promotion. TailorTales is evidence, not authority for PickFlick.

### Decision

Use separate Dokploy projects, credentials, managed PostgreSQL and Redis instances, service aliases,
and application networks for UAT and production. Keep managed data-service external ports disabled
and use Dokploy's internal credentials from the application services; do not define remote
PostgreSQL or Redis services or volumes in application Compose. Issue #15 must verify the UAT
platform configuration and failed external reachability. Issue #16 must verify the same production
contract before production is enabled.

Give each environment a separate private S3-compatible storage scope and credentials. Store
user/Club avatars and generated exports there; keep bundled brand assets in the application static
assets.

Keep one application Compose definition with `release`, `api`, `worker`, and `web`. Native Compose
`depends_on` gates make API and worker wait for the one-shot `release` service to apply committed
migrations and required idempotent seed work; web waits for API health. Release changes must remain
compatible with the running revision until application convergence. A failed release blocks the new
runtime services. Standard Dokploy Compose can replace existing containers during convergence, so
this baseline does not claim failure preservation of the prior runtime revision. No application
service publishes a host port; Dokploy/Traefik owns public routing. Use unique environment-specific
service aliases so web-to-API traffic cannot select a same-named service from another project.

For UAT, Dokploy builds the selected full Git revision from the locked repository. The deployment
record, image revision labels, runtime revision, health response, and browser-smoke result identify
that revision. Disable competing Dokploy and GitHub deployment triggers so one workflow owns each
deployment. Before the first production deployment—or earlier if separate build and deployment
servers are introduced—activate [#115](https://github.com/Shagon1k/PickFlick/issues/115): CI builds
and publishes one web/API/worker/release bundle, records every digest, deploys that bundle to UAT,
and promotes the UAT-proven digests without rebuilding. The release workflow owns digest updates;
operators do not edit independent image references by hand.

Keep non-root runtime users, pinned Dockerfile frontend/base images, the locked install, `init`,
`cap_drop: [ALL]`, `no-new-privileges`, read-only root filesystems with explicit `tmpfs` paths, and
normal restart policies while the application remains compatible. Repository dependency
maintenance owns base-image updates and proves them through the normal build and smoke gates.

Before BullMQ consumers exist, API and worker must handle `SIGTERM`, stop accepting new work, close
their current resources, and exit within Compose's ordinary grace period. Defer a configurable,
job-aware drain deadline until the first real queue consumer. That implementation issue must set
the deadline from measured job duration and prove drain/retry behavior in UAT.

Maintain one small `pnpm compose:check`. It renders synthetic UAT and production configurations and
checks the service set, allowed environments, native release/API/worker ordering, API/web health
gates, absence of application host-published ports, required environment inputs, distinct
environment names/aliases, `init`, dropped capabilities, `no-new-privileges`, and read-only roots
with explicit `tmpfs` writes. Platform preview, managed-service port configuration and reachability,
internal database connectivity, and route behavior are environment checks. Do not add a
general-purpose YAML policy engine.

### Amendment — notification signals (2026-10-27)

The owner-approved PR #197 topology in [ADR-019](#adr-019--distribute-notification-invalidation-through-redis-pubsub)
narrowly amends the managed-Redis/application-Compose restriction above: application Compose may
own one ephemeral, reconstructable notification Pub/Sub broker without persistence or public
exposure, on a project-scoped private network used only by Redis, backend and worker. The original
baseline and control dispositions remain historical context. Managed PostgreSQL is unchanged;
BullMQ, durable queues and non-reconstructable Redis state still require a separate durability and
managed-service decision before use.

### Control disposition

| PR #111 control                                                 | Disposition                                                           | Operational owner            | Current product need                                                                                                         | Maintenance cost                                                                                | Failure mode or activation trigger                                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate UAT/production projects, identities, data, and storage | Adopt now                                                             | Infrastructure owner         | Required before UAT so test configuration cannot select production resources.                                                | Provision and verify duplicate scoped resources and names.                                      | A collision can expose or corrupt production data.                                                                                                |
| Separate UAT/production deployment servers                      | Defer                                                                 | Infrastructure owner         | Logical project and credential separation is sufficient before production exists.                                            | Operate, patch, monitor, and fund a second host.                                                | Activate at production provisioning, or earlier for measured contention or required host-level isolation.                                         |
| PostgreSQL/Redis in application Compose with named volumes      | Reject                                                                | Infrastructure owner         | Applications need private data connections, not a second service lifecycle.                                                  | Duplicates platform backup, upgrade, and monitoring work.                                       | Split ownership can leave data services unpatched or unrecoverable; use Dokploy-managed instances.                                                |
| Four web/API/worker/release build targets                       | Adopt now                                                             | Application maintainers      | The deployables and one-shot migration boundary already have separate runtime commands.                                      | Build and smoke four targets when runtime foundations change.                                   | A missing target makes that runtime or release boundary undeployable.                                                                             |
| Ordered migration/required-seed release gate                    | Adopt now                                                             | Release owner                | Every schema-changing revision needs compatibility checked before application convergence.                                   | Run and observe one idempotent release step per deployment.                                     | Starting incompatible code after a failed migration can break the active revision.                                                                |
| Health-gated API/web startup and worker readiness               | Adopt now                                                             | Application maintainers      | Deployment success must mean required dependencies and HTTP entrypoints are ready.                                           | Maintain focused probes and startup dependency checks.                                          | An unready service can receive traffic or produce a false successful deployment.                                                                  |
| No application or managed data-service host ports               | Adopt now                                                             | Infrastructure owner         | Traefik and private internal connections are the only intended network entrypoints.                                          | Maintain routing and inspect platform port settings plus external reachability per environment. | A published port bypasses the intended ingress or data-access boundary.                                                                           |
| Full source-revision labels and clean-source validation         | Adopt now                                                             | CI/release owner             | Source-built UAT evidence must identify the exact code it exercised.                                                         | Preserve labels, runtime revision reporting, and clean-source checks.                           | A dirty or unidentified build cannot support promotion or rollback decisions.                                                                     |
| Prebuilt registry images promoted by digest                     | Defer in [#115](https://github.com/Shagon1k/PickFlick/issues/115)     | CI/release owner             | UAT can build a selected revision before production promotion exists.                                                        | Operate a registry publisher, digest manifest, retention, and promotion workflow.               | Activate before the first production deployment or when build and deployment servers separate.                                                    |
| Digest-pinned PostgreSQL/Redis Compose images                   | Reject                                                                | Infrastructure owner         | Managed services leave application Compose.                                                                                  | Duplicates the platform version and upgrade controls.                                           | Competing pins can misstate the version the platform actually operates.                                                                           |
| Redis AOF durability                                            | Defer                                                                 | Infrastructure owner         | Redis has no BullMQ queue or other non-reconstructable application state yet; PostgreSQL remains the domain source of truth. | Configure managed persistence and monitor storage, rewrite, and recovery behavior.              | Activate before the first BullMQ consumer or other Redis state that must survive process loss; without it pending work can be lost.               |
| Pinned build frontend/base images and frozen lockfile           | Adopt now                                                             | Dependency maintenance owner | Source builds need reviewable toolchain and dependency inputs.                                                               | Submit focused pin updates and rerun build/smoke evidence.                                      | Stale pins miss security or runtime updates; floating inputs make builds drift.                                                                   |
| Non-root users, dropped capabilities, and `no-new-privileges`   | Adopt now                                                             | Application maintainers      | Current images support these low-cost least-privilege defaults.                                                              | Retest compatibility when runtime tools or base images change.                                  | Removing a control increases container privilege; incompatible changes fail build or smoke checks.                                                |
| Read-only roots with explicit `tmpfs` writes                    | Adopt now                                                             | Application maintainers      | Current runtimes need only the documented temporary write paths.                                                             | Keep the write-path inventory and smoke checks current.                                         | An undeclared write fails at runtime; a broad writable root increases tampering scope.                                                            |
| `init`, `SIGTERM`, and ordinary stop grace                      | Adopt now                                                             | Application maintainers      | API and worker already need correct signal forwarding and bounded resource closure.                                          | Maintain lifecycle handlers and termination tests.                                              | Bad forwarding or unbounded shutdown can drop work or stall convergence.                                                                          |
| Configurable queue-aware drain and grace/timeout coupling       | Defer                                                                 | Worker owner                 | No BullMQ consumer has a measured job duration yet.                                                                          | Tune coordinated deadlines and test retry/visibility behavior.                                  | Activate with the first BullMQ consumer and derive the window from measured jobs.                                                                 |
| Normal application restart policies                             | Adopt now                                                             | Application maintainers      | MVP runtimes should recover from transient process failure.                                                                  | Diagnose persistent restart loops through deployment logs and health.                           | Without restart, a transient exit leaves a service down; persistent failure remains visible as unhealthy.                                         |
| Worker-only egress bridge                                       | Reject                                                                | Infrastructure owner         | A normal bridge provides no enforceable destination restriction.                                                             | Maintains extra network wiring without a policy boundary.                                       | Propose a firewall or allowlist when provider access creates an enforceable requirement.                                                          |
| Native Compose release dependencies                             | Adopt now                                                             | Release owner                | A plain, repository-owned dependency graph gates API and worker on the one-shot release service.                             | Maintain focused ordering assertions and UAT failure visibility.                                | Standard Compose may replace prior containers during convergence; migrations must remain backward compatible and failures must remain observable. |
| Repository-specific Compose validation                          | Adopt now in [#114](https://github.com/Shagon1k/PickFlick/issues/114) | Application maintainers      | Cheap static checks protect release, routing, isolation, and adopted hardening invariants.                                   | Update focused assertions when the four-service topology changes.                               | Drift can silently remove a gate, publish a port, collide aliases, or weaken container controls.                                                  |
| General-purpose YAML policy engine                              | Reject                                                                | Application maintainers      | One small repository-owned Compose file does not need a policy language.                                                     | Adds a dependency, ruleset, and specialist maintenance surface.                                 | The policy layer can drift from the Compose contract without reducing a current risk.                                                             |

### Consequences

- UAT provisioning no longer waits for a registry pipeline or application-owned database lifecycle.
- The application and managed data services may share a Dokploy network on one server. Unique
  aliases and separate credentials prevent accidental selection; this baseline does not claim
  network-level egress or cross-project isolation that Dokploy does not enforce.
- Source builds preserve revision traceability but not byte-for-byte artifact identity. Production
  remains disabled until #115 supplies the stronger digest-promotion guarantee.
- Successful application convergence may have a brief availability window. A failed release leaves
  the running application revision untouched. Rolling or blue-green delivery needs a measured
  availability requirement and a separate topology decision.
- Release-failure behavior, internal database access, proxy routing, and environment separation
  still require real UAT evidence; static YAML checks cannot prove them.

### Follow-up work

- [#113](https://github.com/Shagon1k/PickFlick/issues/113) aligns the application Compose topology
  before UAT provisioning while retaining native Compose release dependencies.
- [#114](https://github.com/Shagon1k/PickFlick/issues/114) reduces the maintained Compose check to
  the approved contract while preserving assertions for adopted static hardening controls.
- [#115](https://github.com/Shagon1k/PickFlick/issues/115) is Deferred until production promotion
  or separate build/deployment servers make digest-addressed bundles necessary.

### Verification

Issues #113 and #114 must prove the source-built four-service Compose render, staged release and
health gates, absence of application host ports, adopted static hardening, and distinct
UAT/production identities before issue #15 provisions UAT. Issue #15 must then inject a failed
release and prove that the prior container identities, revision, and health remain unchanged. It
must also prove internal managed-data access, disabled external database/Redis ports, failed
external reachability, routing, browser smoke, and rollback compatibility. Issue #16 must verify the
same disabled external-port contract for production before production is enabled. Issue #115 must
pass before the first production deployment.

### Evidence

- [Dokploy managed databases](https://docs.dokploy.com/docs/core/databases)
- [Dokploy internal database connections](https://docs.dokploy.com/docs/core/databases/connection)
- [Dokploy database backups](https://docs.dokploy.com/docs/core/databases/backups)
- [Dokploy isolated Compose deployments](https://docs.dokploy.com/docs/core/docker-compose/utilities)
- [Dokploy Compose domains](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Docker Engine security](https://docs.docker.com/engine/security/)
- [Docker Compose service controls](https://docs.docker.com/reference/compose-file/services/)
- [TailorTales application Compose at reviewed revision](https://github.com/Shagon1k/TailorTales/blob/69577359bfedffe7492b4a013e6c39456a18a237/deploy/docker-compose.yml)
- [TailorTales deployment flow at reviewed revision](https://github.com/Shagon1k/TailorTales/blob/69577359bfedffe7492b4a013e6c39456a18a237/_docs/guides/deployment.md)
- [TailorTales UAT workflow at reviewed revision](https://github.com/Shagon1k/TailorTales/blob/69577359bfedffe7492b4a013e6c39456a18a237/.github/workflows/deploy-uat.yml)
- [TailorTales production workflow at reviewed revision](https://github.com/Shagon1k/TailorTales/blob/69577359bfedffe7492b4a013e6c39456a18a237/.github/workflows/deploy-prod.yml)

### Amendment — 2026-09-26

The worker and Redis are removed until the first background job ([ADR-014](#adr-014--run-two-entrypoints-until-the-first-background-job)).
Application Compose now runs `release`, `api`, and `web`; environments provision PostgreSQL and
object storage only. The deployment-configuration checker script is removed; `pnpm compose:check`
renders the local, deploy, and preview Compose files.

## ADR-008 — Promote source-built production from UAT-proven SemVer tags

- **Status:** Accepted
- **Date:** 2026-09-11
- **Decider:** Developer
- **Owning issue:** [#16](https://github.com/Shagon1k/PickFlick/issues/16)
- **Amends:** [ADR-007](#adr-007--use-a-proportional-dokploy-deployment-baseline) production-promotion mechanics

### Context

ADR-007 kept source-built UAT but required issue #115's registry-published digest bundle before the
first production deployment. Since that decision, issue #15 aligned PickFlick's exact-revision UAT
flow with the proportional TailorTales operating model and proved it on the shared application
Compose topology. PickFlick still has no separate build/deployment servers, registry publisher, or
production traffic. Building a registry pipeline now would add credentials, retention, manifest,
and partial-publication failure modes without protecting a current boundary.

The reviewed TailorTales production flow builds the same Compose topology from an immutable SemVer
tag after checking exact UAT evidence. PickFlick can use that smaller mechanism while preserving an
explicit activation point for digest-qualified bundles when source and deployment hosts separate or
another concrete byte-identity requirement appears.

### Decision

Use the same `compose.deploy.yaml` for source-built UAT and production. UAT builds `main` and accepts
a run only when Dokploy's deployment record and the live API report the exact triggering revision.
A manual GitHub Actions workflow resolves current `main`, requires the `UAT E2E` job to have
completed successfully in an exact UAT workflow run for that full revision, and creates or reuses
an annotated stable SemVer tag. With no stable tag, version calculation starts from `v0.0.0`. A
retry reuses the highest stable tag when it already points to current `main`, so failure after tag
creation does not consume another version.

Keep production fail-closed through two independent controls. The repository variable
`PRODUCTION_DEPLOY_ENABLED` must equal exact lowercase `true` before GitHub schedules the deploy job.
After protected-environment approval, the deployment controller reads the current repository value
and repeats the same check before reading Git or Dokploy state. Put the deploy job behind a protected
GitHub `production` environment. Keep the Dokploy production Compose resource's automatic deployment
disabled. Before issue #16 completes, leave the guard false and do not attach a production traffic
route.

When a later owner-approved release enables the guard, the workflow checks that `main` has not
advanced, verifies the inactive production resource contract, creates or reuses the tag, pins the
resource to that tag with automatic deployment still disabled, triggers one deployment, and waits
for a correlated deployment record to report that release SHA. A later run that finds the resource
already pinned to the same release stops for manual reconciliation instead of triggering another
deployment. The local `pnpm deploy:compose` command remains UAT-only; a workstation cannot use it to
converge production.

Keep issue #115 Deferred until separate build/deployment servers or another concrete
artifact-identity requirement makes source identity insufficient. At that trigger, publish one
web/API/worker/release digest bundle, prove it in UAT, and replace only the artifact transport in the
production workflow. The UAT-evidence, SemVer, guard, migration, and rollback contracts remain.

### Consequences

- Production promotion identifies immutable source through a Git tag but does not guarantee that
  UAT and production builds are byte-for-byte identical.
- UAT and production can use one reviewed Compose definition and the same Dokploy build mechanics.
- The guard-disabled workflow can validate release identity and UAT evidence without receiving
  production credentials or changing external state.
- A tag can exist after a later Dokploy failure. Retrying the same `main` revision reuses it; tags
  are never moved or deleted.
- Production rollback selects a prior immutable tag only when the applied schema remains compatible.
  Incompatible schema/data changes require a forward fix.
- Registry publication remains an explicit deferred control rather than disappearing from the
  architecture.

### Alternatives considered

- **Require issue #115 before any production path exists.** Rejected for the current single-host
  source-build topology because it adds an unused registry control before a protected boundary
  exists.
- **Deploy production directly from `main`.** Rejected because the selected release would move when
  `main` advances and would not provide an immutable rollback reference.
- **Use a manually entered revision or tag.** Rejected because the workflow can resolve current
  `main`, derive the version, and verify UAT evidence without accepting a spoofable operator value.
- **Rely only on the Dokploy automatic-deploy switch.** Rejected because the GitHub guard and
  protected environment prevent credentials and mutation logic from running before Dokploy is
  contacted.

### Verification

Issue #16 must prove stable SemVer calculation, exact workflow/repository/revision UAT matching, a
successful `UAT E2E` job, rejection of missing or failed evidence, stale-`main` rejection,
production-resource validation, release-SHA deployment correlation, idempotent tag reuse, and zero
Git/Dokploy calls while the guard is false. `pnpm compose:check` must continue to validate both
environment renders. The owner must separately confirm the dormant live resource, disabled ports,
absent production route, and false repository guard before production provisioning evidence is
complete.

### Evidence

- [Issue #16](https://github.com/Shagon1k/PickFlick/issues/16) and the developer's 2026-09-11
  human-control approval of the TailorTales-aligned production approach.
- ADR-007's evidence list above, including the reviewed TailorTales Compose, deployment guide, UAT
  workflow, and production workflow revision.

### Amendment — 2026-09-26

The promotion decision is unchanged. Its implementation moved from Node scripts into the
`deploy-uat.yml` and `promote-production.yml` workflow steps: Dokploy contract and status checks,
readiness of the exact deployed revision, the successful `UAT E2E` check-run requirement, and
annotated-tag creation. Production deployment still requires `PRODUCTION_DEPLOY_ENABLED=true` and
the `production` environment approval.

## ADR-009 — Use one public contact and environment-specific Resend senders

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decider:** Product owner (Alex)
- **Owning issue:** [#20](https://github.com/Shagon1k/PickFlick/issues/20)

### Context

Public Contact and legal copy need one durable address that does not expose a personal mailbox.
Application email also needs an authenticated sender identity without allowing UAT configuration to
select the production sender or credentials.

The product owner has configured Google Workspace to receive mail for `pick-flick.app` and controls
the Cloudflare DNS zone, Google Workspace, and Resend account. A read-only public DNS inspection on
2026-09-13 found Cloudflare nameservers, Google root-domain mail routing, and separate Resend
authentication records for `pick-flick.app` and `uat.pick-flick.app`. No DMARC record was present.
This ADR records neither provider-generated record values nor credentials.

Resend supports sending from any address at a verified domain. Its sending Return-Path records use
a subdomain and can coexist with a root-domain inbox provider. Resend recommends a dedicated sender
subdomain to isolate reputation, but PickFlick's MVP sends transactional and opted-in application
mail only. A new sender subdomain and receiving route would add configuration without a current
marketing or high-volume isolation requirement.

### Decision

Publish `hello@pick-flick.app` as the only public Contact and legal address. Google Workspace
receives that address. Keep the address stable when the responsible person or destination mailbox
changes by updating private routing instead of public copy.

Send production application email through Resend as
`PickFlick <notifications@pick-flick.app>`. The notification adapter must set `Reply-To` to
`hello@pick-flick.app`. Before production release, configure Google Workspace so direct mail to the
sender address reaches the same owner-controlled contact queue.

Send UAT application email through Resend as
`PickFlick UAT <notifications@uat.pick-flick.app>`. UAT uses a separate sending-only API key
restricted to `uat.pick-flick.app`, synthetic content, and explicitly approved test recipients. It
does not need a Google Workspace mailbox for the sender address. Production uses a separate
sending-only key restricted to `pick-flick.app`. Local development and CI keep the disabled Resend
placeholder and an `example.invalid` sender.

Do not enable Resend Inbound or replace Google Workspace with Cloudflare Email Routing for this
decision. Do not fall back from Resend to personal SMTP, UAT credentials, or another environment.
The owning Contact or notification workflow must preserve retryable intent, bound retries, record
delivery state, and surface persistent failure without logging message content.

Alex retains administrative ownership and recovery control for Cloudflare DNS, Google Workspace,
and Resend. Provider access may be delegated with least privilege, but these resources must not
depend on a contractor-owned account. Store Resend credentials only in the owning environment's
secret store; never record them in repository source, rendered configuration, logs, or evidence.

Before production email validation, publish DMARC in monitoring mode and confirm every legitimate
Google Workspace and Resend sender passes. Move to `quarantine` or `reject` only after reviewing the
reports. Issue #20 records this requirement but does not authorize or perform DNS or provider
changes.

### Consequences

- Contact, notification, legal, and release work share one approved public identity.
- Production and UAT have visibly distinct From addresses and cannot share a domain-restricted key.
- Root-domain human and application email share domain reputation. Transactional-only use,
  domain-restricted credentials, suppression handling, and staged DMARC reduce but do not remove
  that coupling.
- Direct replies remain useful through `Reply-To`; production provisioning must also route mail
  addressed directly to `notifications@pick-flick.app`.
- A future marketing or materially higher-volume email requirement must revisit sender-subdomain
  isolation before it sends through the production identity.

### Alternatives considered

- **Use `mail.pick-flick.app` for production sending.** Deferred because it adds another verified
  domain and direct-reply route before PickFlick has a marketing or high-volume reputation boundary.
- **Use one sender for UAT and production.** Rejected because a credential or configuration mistake
  could make UAT send with the production identity.
- **Use Cloudflare Email Routing for the public address.** Rejected because Google Workspace already
  owns root-domain inbound mail and supports a real owner-controlled mailbox and replies.
- **Use Resend Inbound for the public address.** Rejected because webhook verification, message and
  attachment processing, retention, and operational recovery expand the Contact scope without a
  current need.
- **Publish a personal fallback address.** Rejected because it leaks a replaceable operator identity
  into permanent public and legal copy.

### Verification

Issue #20 must keep the exact public, production, UAT, and local identities consistent across the
Roadmap, Design, Architecture, environment reference, and UAT/production runbooks. Repository
verification may inspect only public DNS record presence and must not retain record values.

Before dependent production release validation, the owner must separately prove that Google
Workspace receives `hello@pick-flick.app` and direct sender mail, Resend reports both sender domains
verified, the UAT and production keys are sending-only and domain-restricted, test messages pass
SPF/DKIM, replies reach the public contact queue, and staged DMARC does not reject legitimate mail.

### Evidence

- Product-owner approval in issue #20's human-controlled engineering run on 2026-09-13.
- [Resend domain verification and sender-subdomain guidance](https://resend.com/docs/dashboard/domains/introduction)
- [Resend sender-address behavior](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend)
- [Resend coexistence with an existing inbox provider](https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records)
- [Resend API-key permissions and domain restriction](https://resend.com/docs/dashboard/api-keys/introduction)
- [Resend DMARC rollout guidance](https://resend.com/docs/dashboard/domains/dmarc)
- [Google Workspace MX setup](https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace)

### Amendment — 2026-09-26

Contact messages are no longer stored or delivered by a worker. The API sends each valid message
through Resend with `Reply-To` set to the visitor's address when given, and answers `503` when
delivery fails; the form keeps the visitor's text so they can retry. Rate limiting uses
`@nestjs/throttler`. Sender identities and environment rules above are unchanged.

## ADR-010 — Use Better Auth at the API boundary

- **Status:** Accepted
- **Date:** 2026-09-16
- **Decider:** Developer (Alex)
- **Owning issue:** [#25](https://github.com/Shagon1k/PickFlick/issues/25)

### Context

ADR-002 places OAuth callbacks, identity linking, server sessions, revocation, and authorization in
the NestJS API. PickFlick now needs a maintained implementation for Google and Apple that preserves
that boundary, stores opaque sessions server-side, supports immediate revocation, and prevents an
email match from silently merging or hijacking Users.

Auth.js remains a valid choice for an application where Next.js owns the authenticated server
boundary. Its current documentation says an existing working installation does not need an urgent
migration, but recommends Better Auth for new projects. Putting NextAuth in `apps/web` here would
either split authentication from NestJS authorization or require Next.js to become the mandatory
BFF for REST, SSE, and file access. That is a coherent alternative architecture, but it would
supersede ADR-002 rather than implement it. Auth.js exposes an Express integration, but its security
guidance currently describes non-adapter `@auth/*` packages as under development and not generally
production-ready.

NestJS Passport integrates naturally with guards and provider strategies, but it does not supply
the complete account-linking, database-session, revocation, and provider-token contract. PickFlick
would own more security-critical code. SuperTokens supplies NestJS integration and self-hosting but
adds a separate trusted Core service, and its documented account-linking feature requires a paid
plan. Neither trade-off is proportional to this modular-monolith MVP.

Better Auth provides built-in Google and Apple providers, a Prisma 7 adapter, database-backed
sessions, session revocation, configurable account linking, OAuth callback checks, trusted-origin
checks, and custom cookie attributes. Its core handler is framework-agnostic and can run at the
API's Express boundary without moving session authority to Next.js.

### Decision

Use the supported stable Better Auth line as the OAuth and session engine inside `apps/api`. Mount
its handler on the same-origin API boundary and integrate its Prisma adapter with the repository's
PostgreSQL client. Review and commit every auth schema change through the existing Prisma/manual-SQL
migration workflow; generated schema never authorizes an automatic migration.

Keep `User` as the PickFlick product identity. Identify provider accounts by the unique pair
`(provider, providerSubject)`. Disable implicit account linking. A signed-out OAuth attempt whose
email matches an existing User fails with a safe account-not-linked result. Link another provider
only through an explicit, single-use flow bound to a fresh authenticated session. That flow may
accept a different provider email for Apple relay support, but it never overwrites the User's email
or reassigns a provider identity already owned by another User. Do not allow a User to unlink their
last provider identity.

Use database-backed sessions with Better Auth's stateless mode and session cookie cache disabled.
The browser receives only an opaque identifier in a host-only production cookie whose name begins
with `__Host-` and whose attributes include `Secure`, `HttpOnly`, and `Path=/` without `Domain`.
Keep durable session meaning, provider tokens, roles, and permissions server-side. Preserve
ADR-002's explicit CSRF and Origin checks, deny credentialed cross-origin browser access, rotate the
session after authentication and privilege changes, and revoke all sessions on suspension or
account deletion.

Next.js may render auth state, start same-origin auth actions, and redirect optimistically. It must
not parse the session cookie or become an authorization authority. Every REST, SSE, file, and
administrative boundary resolves the session and current permissions through the API-owned Identity
module.

Pin the concrete Better Auth version in the workspace manifest and lockfile rather than in this ADR.
Better Auth supports only its current release, so dependency maintenance must track the supported
stable line and prioritize security updates. Provider issues add exact environment variables,
typed startup validation, migration changes, and tests when those values and schemas become active.

The implementation-ready provider, conflict, callback, return-to-intent, cookie, and verification
contract lived in the Phase 4 plan; after Phase 6 consolidation it is summarized in
[ARCHITECTURE.md](../../ARCHITECTURE.md#5-cross-cutting-contracts) and retained in Git history.

### Consequences

- Authentication and authorization keep one API-owned trust boundary.
- Google and Apple use one session representation and one provider-identity model.
- Explicit linking handles Apple relay addresses without trusting email as an identity key.
- Immediate revocation requires a database session lookup on protected requests; issue #28 may
  optimize only after preserving that guarantee.
- Better Auth owns protocol mechanics, while PickFlick still owns authorization, linking policy,
  schema review, safe recovery, configuration, and provider lifecycle tests.
- The NestJS/Express handler order and Prisma schema fit are integration risks that issue #26 must
  prove before broader auth implementation proceeds.
- A future move to Next.js-owned auth or a separate identity service requires a superseding ADR.

### Alternatives considered

- **NextAuth/Auth.js in Next.js.** Rejected for the current architecture because it splits session
  ownership from the API or requires Next.js to become the mandatory BFF. Revisit only with a
  superseding trust-boundary decision.
- **Auth.js at the Express API boundary.** Rejected because the current Express package is still
  documented as under development, while the Auth.js project recommends Better Auth for new work.
- **NestJS Passport plus custom sessions and linking.** Rejected because PickFlick would own more
  callback, linking, revocation, and session-security behavior without a product requirement for
  that control.
- **Self-hosted SuperTokens.** Rejected because a separate Core service expands deployment and
  operations, while account linking adds a paid dependency.
- **JWT sessions.** Rejected because immediate server-side suspension and revocation are product
  requirements and ADR-002 already rejects browser-managed bearer credentials.

### Verification

Issue #26 must prove the Better Auth/NestJS mount, reviewed Prisma migration, Google callback,
cookie attributes, CSRF/Origin rejection, immediate session revocation, return-target validation,
and absence of provider tokens in browser storage and logs. Issue #27 must prove Apple first-return
handling, relay email, explicit linking, duplicate/conflict denial, and provider-identity uniqueness.
Issue #28 must prove unauthenticated, forged, suspended, expired, and revoked denial across REST,
SSE, files, and App Admin operations.

Until those issues provide named code and runtime evidence, authentication remains `Proposed` in
`ARCHITECTURE.md`.

### Evidence

- Alex's approval of the API-owned Better Auth direction in issue #25's human-controlled run on
  2026-09-16.
- [Better Auth OAuth and provider behavior](https://better-auth.com/docs/concepts/oauth)
- [Better Auth Apple provider](https://better-auth.com/docs/authentication/apple)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth account linking](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth security controls](https://better-auth.com/docs/reference/security)
- [Better Auth configuration options](https://better-auth.com/docs/reference/options)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth cookie behavior](https://better-auth.com/docs/concepts/cookies)
- [Better Auth Express integration](https://better-auth.com/docs/integrations/express)
- [Auth.js migration guidance](https://authjs.dev/getting-started/migrate-to-better-auth)
- [Auth.js security and package status](https://authjs.dev/security)
- [NestJS Passport integration](https://docs.nestjs.com/recipes/passport)
- [SuperTokens NestJS integration](https://supertokens.com/docs/quickstart/integrations/nestjs)
- [SuperTokens account-linking availability](https://supertokens.com/docs/post-authentication/account-linking/introduction)

### Amendment — 2026-09-26

- Explicit provider linking is deferred until a product need appears. Implicit linking stays
  disabled: a signed-out sign-in whose email matches another User fails safely, and one User keeps
  one provider identity.
- Google and Apple use Better Auth's built-in `socialProviders`. Apple returns a name only on first
  consent, so a missing name falls back to the email address.
- The local patch to Better Auth's OAuth state consumption is removed; the supported release is used
  unmodified.

## ADR-011 — Organize the API by feature module with one database client

- **Status:** Accepted
- **Date:** 2026-09-18
- **Decider:** Developer (Alex)
- **Owning issue:** [#29](https://github.com/Shagon1k/PickFlick/issues/29)

### Context

The first Club implementation added a complete domain slice, but its controller, services,
repository binding, tier resolver, Identity providers, Contact providers, and Health providers were
all registered in `AppModule`. Repeating that pattern for Sessions, Billing, and Notifications would
make the composition root depend on feature internals. Identity, Contact, and Clubs also created
separate long-lived Prisma clients with separate shutdown hooks.

### Decision

Give each API feature a Nest module that owns its controllers, services, repository adapters, and
other internal providers. Export only a capability with a current cross-module consumer. Keep
`AppModule` limited to feature/infrastructure imports, the root controller, and application-wide
guard configuration.

Provide validated runtime values through one application-wide runtime module. Provide one
application-scoped Prisma client through `DatabaseModule`; feature repositories and Identity import
that module and share its lifecycle. `DatabaseService` alone disconnects the client during Nest
shutdown. Do not make feature modules or the database module global.

### Consequences

- Feature implementation details stay out of the composition root and remain private by default.
- Cross-feature dependencies must use an explicitly exported token or service.
- API database consumers share one connection-pool lifecycle instead of creating a client per
  repository.
- Standalone integration scripts still own their process-local client lifecycle explicitly.

### Alternatives considered

- **Register feature providers directly in `AppModule`.** Rejected because the root would accumulate
  feature-specific controllers, repositories, and adapters.
- **Let each repository own a Prisma client.** Rejected because independent long-lived pools and
  shutdown hooks obscure application resource ownership.
- **Make every module global.** Rejected because it hides dependency direction and makes accidental
  cross-feature coupling easier.

### Verification

Issue #29 must prove that the application boots through the real feature modules, Club and Contact
repository bindings resolve inside their owning modules, Identity and both repositories share one
database client, protected Club policy behavior remains unchanged, and Club database integration
checks pass.

### Evidence

- The developer's architecture request in pull request
  [#150](https://github.com/Shagon1k/PickFlick/pull/150) on 2026-09-18.

### Amendment — 2026-09-26

Infrastructure that every feature uses — the runtime environment, `PrismaService`, and object
storage — is provided by `@Global()` modules, following NestJS convention. Feature modules stay
non-global and export only what another module consumes.

## ADR-012 — Validate boundaries with shared zod schemas

- **Status:** Accepted
- **Date:** 2026-09-26
- **Decider:** Developer (Alex)
- **Owning issue:** [#32](https://github.com/Shagon1k/PickFlick/issues/32)

### Context

Request bodies, form values, and environment variables were validated by hand-written parsers in
the API, the web app, and the config package, each with its own error shapes. The same Club and
Contact rules were written twice.

### Decision

Describe every untrusted input as a zod schema. Request schemas live in `@pickflick/contracts` and
are shared by the API (`ZodValidationPipe`) and web forms; response shapes stay plain TypeScript
interfaces. `@pickflick/config` validates the environment with one zod schema plus a small table of
cross-variable rules. Forms map schema failures to friendly per-field copy; zod's own messages are
for developers.

### Consequences

- One definition per rule; API and forms cannot drift.
- zod is a runtime dependency of contracts, config, API, and web.
- Friendly form copy still lives next to each form.

### Alternatives considered

- **Keep hand-written validators.** Rejected: duplicated rules and bespoke error plumbing.
- **class-validator DTOs in the API.** Rejected: the web could not reuse them.

### Evidence

- [zod](https://zod.dev)

## ADR-013 — Keep the UI kit in the web app on unstyled Mantine

- **Status:** Accepted
- **Date:** 2026-09-26
- **Decider:** Developer (Alex)
- **Owning issue:** [#32](https://github.com/Shagon1k/PickFlick/issues/32)
- **Supersedes:** [ADR-006](#adr-006--own-projector-noir-and-use-mantine-selectively)

### Context

`packages/ui` held one global stylesheet and a mix of hand-rolled and Mantine-backed primitives.
Only the web app consumed it, so the package boundary added build steps without isolation, and
hand-rolled buttons, fields, and switches re-implemented behavior Mantine already provides.

### Decision

Move the UI kit to `apps/frontend/src/components/ui/<Name>/`: one folder per component with its own SCSS
module and a default export. Buttons, text fields, select, switch, tabs, modal, and menu wrap
Mantine components rendered `unstyled`, so Projector Noir owns every slot's styling. Tokens live in
`styles/tokens.scss`; the Mantine theme lives in `theme/mantine.ts`. Only the kit and theme import
`@mantine/*` (lint-enforced), except `@mantine/form`, which forms use directly.

### Consequences

- Projector Noir stays the only visual authority; Mantine supplies focus, keyboard, and overlay
  behavior.
- No separate UI build; changes land with the screens that use them.
- Visual regressions are caught by the Playwright baselines at 390 and 1440 pixels.

### Alternatives considered

- **Keep `packages/ui`.** Rejected: a package with one consumer.
- **Use Mantine's default styles.** Rejected for the reasons in ADR-006.

### Evidence

- [Mantine unstyled components](https://mantine.dev/styles/unstyled/)
- [Mantine form](https://mantine.dev/form/use-form/)

## ADR-014 — Run two entrypoints until the first background job

- **Status:** Accepted
- **Date:** 2026-09-26
- **Decider:** Developer (Alex)
- **Owning issue:** [#32](https://github.com/Shagon1k/PickFlick/issues/32)
- **Supersedes:** [ADR-001](#adr-001--use-a-pnpm-modular-monorepo-with-three-runtime-entrypoints)
  (third entrypoint) and [ADR-004](#adr-004--use-bullmq-with-a-transactional-outbox)

### Context

The worker, Redis, and outbox existed only to deliver Contact email. Sending that email directly
from the API removes their one caller, leaving a process, a data service, and retry machinery with
nothing to do.

### Decision

Keep the pnpm monorepo with two runtime entrypoints, `apps/frontend` and `apps/backend`, plus the one-shot
release job. Remove the worker, Redis, the observability package, and the Contact outbox. The phase
that introduces the first background job (Session deadlines or notifications) records a new ADR for
its queue; a transactional outbox with BullMQ remains the default candidate.

The entrypoints are named `apps/frontend` and `apps/backend`, matching TailorTales; they were
`apps/web` and `apps/api` before Phase 6, and earlier ADRs use those names.

### Consequences

- Fewer processes and services to run, deploy, and monitor.
- Session deadline work must bring its queue design with it.

### Alternatives considered

- **Keep an idle worker and Redis.** Rejected: operating cost without a caller.

## ADR-015 — Send a nonce-based CSP and security headers from each runtime

- **Status:** Accepted
- **Date:** 2026-09-26
- **Decider:** Developer (Alex)
- **Owning issue:** [#32](https://github.com/Shagon1k/PickFlick/issues/32)

### Context

Responses carried no Content Security Policy, HSTS, or framing protection. Every page already
renders per request (it reads the session), so a per-request nonce costs no static rendering. The
frontend proxies `/api/*` to the backend, and Next.js does not add its configured headers to
proxied responses.

### Decision

- **Pages.** `proxy.ts` generates a nonce per page request and sends a CSP that runs scripts only
  with that nonce or when a nonced script loads them (`'strict-dynamic'`). The root layout passes
  the nonce to Mantine's inline theme script. Styles allow `'unsafe-inline'`, because React and
  Mantine set `style` attributes, which a nonce cannot cover. The policy also forbids plugins,
  framing, foreign form targets, and foreign `<base>`.
- **Every frontend response.** `next.config.ts` adds HSTS (one year, no subdomains),
  `nosniff`, a same-origin-on-downgrade referrer policy, a permissions policy that turns off
  camera, microphone, and geolocation, and a same-origin opener policy.
- **API responses.** The backend sets its own headers in `configureApplication`: a CSP that allows
  nothing (`default-src 'none'`), `no-referrer`, HSTS, and `nosniff`, and it drops `X-Powered-By`.
- zod skips its `eval` probe (`jitless`) in the browser, set in `instrumentation-client.ts`, so the
  strict policy raises no violations.

### Consequences

- An injected inline script or foreign script does not run, and no site can frame PickFlick.
- A new third-party script, font, image host, or API origin needs an explicit policy change.
- HSTS without `includeSubDomains` or `preload` stays reversible until every subdomain is known to
  serve HTTPS.
- The Playwright suite fails on any CSP violation on the built pages; `pnpm test:e2e` checks the
  headers on the built frontend and backend.

### Alternatives considered

- **Static CSP with `'unsafe-inline'` scripts.** Rejected: it does not stop injected inline script,
  the main thing a CSP is for.
- **Hash-based CSP.** Rejected: Next.js emits per-page inline scripts whose hashes change every
  build.
- **`helmet` in the backend.** Rejected for now: four fixed headers do not justify a dependency.

### Evidence

- [Next.js Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Security-Policy)
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)

## ADR-016 — Use a PostgreSQL queue for Movie refresh

- **Status:** Proposed; developer approval required before queue implementation
- **Date:** 2026-10-09
- **Owning issue:** [#36](https://github.com/Shagon1k/PickFlick/issues/36)
- **Decision context:** first background job under ADR-014

### Context

Movie metadata needs durable, idempotent refresh jobs. ADR-014 removed the unused worker and
Redis and left BullMQ with a transactional outbox as the default candidate for the first job.
The current workspace already has PostgreSQL and Prisma. This job refreshes one canonical
record and has no external irreversible side effect.

### Proposed decision

Use a PostgreSQL `MovieRefreshJob` table with one row per Movie and a separate worker process
built from the backend package. Keep API and worker composition separate, sharing the catalog
module rather than introducing a domain package with no second code consumer.

The queue must provide:

- an atomic uniqueness boundary that coalesces repeated enqueue requests;
- transactional due-job claims with `FOR UPDATE SKIP LOCKED`, bounded leases, and claim tokens;
- compare-and-set completion so an expired owner cannot finish another worker's job;
- retry times honoring provider `Retry-After`, bounded exponential retries, and visible terminal
  failure; removed Movies keep identity and stop automatic retry;
- persisted attempt counts, safe reason codes, last start/finish times, next run, and structured
  events without provider response text or credentials;
- a validated refresh-cadence settings contract reused by the later Admin layer, with no new
  Admin endpoint or permission grant in #36;
- startup/reconciliation scans for stale Movies and expired claims, and graceful shutdown.

### Consequences

No new runtime dependency or data service is needed. Deployment adds a worker entrypoint from
an existing package/image. Queue writes and canonical identity remain in one database.
This is a small Movie-specific queue, not a general scheduling framework. Session deadlines
and notification delivery must assess their own delivery and transactional-outbox guarantees.

### Alternatives

- **BullMQ plus Redis and transactional outbox:** ADR-014's default candidate. Better established
  queue operations and tooling, with new dependencies and a Redis service. Requires explicit
  dependency and topology approval.
- **API-only timer:** rejected for this proposal; no independent worker, durable claims, or
  crash recovery.

The engineering run has requested the developer's queue choice. This proposal does not claim
an accepted decision or implemented refresh-job acceptance.

## ADR-017 — Keep Movie identity independent of catalog sources

- **Status:** Accepted; implements the developer's [PR #160 request](https://github.com/Shagon1k/PickFlick/pull/160#discussion_r4231984082)
- **Date:** 2026-10-09
- **Owning issue:** [#36](https://github.com/Shagon1k/PickFlick/issues/36)

### Context

The first catalog adapter exposed TMDB IDs, paths and ratings directly. That made switching
sources change domain identity and public links. PickFlick starts with PoiskKino search/media
and TheTVDB English enrichment; TMDB must remain a selectable alternative.

### Decision

`MoviesService` remains the catalog facade. Public search results, details and related links
use `Movie.id` UUID; future Session and Library relationships reference that same UUID.
`IMovieProvider` owns API adaptation, matching and section precedence. Provider records contain
normalized metadata and verified external IDs, and never allocate public UUIDs.

There are two concrete adapter configurations: `CompositeMovieProvider` wraps PoiskKino and
TheTVDB as one logical provider; `TmdbClient` implements the same `IMovieProvider` with one API.
The composite owns search, enrichment, matching, field priorities, source errors and reuse of
internal source snapshots. `MoviesService` receives one normalized record and an aggregate
projection-cache status; it neither loads source snapshots nor checks individual source clocks.
UUID resolution and persistence remain shared domain responsibilities. No arbitrary provider
combination engine is introduced.

`MovieExternalId(movieId, source, externalId)` uniquely identifies `(source, externalId)` and
allows one ID per source for a Movie. All ingestion paths resolve verified IDs in a transaction.
A shared IMDb or an explicit cross-provider ID permits reuse; title/year never establishes
identity. Conflicting IDs or already separate canonical UUIDs require reviewed reconciliation,
not an automatic merge that could reassign domain links.

The additive migration preserves existing UUIDs, TMDB links, valid IMDb links and source
removal observations. Contradictory legacy IMDb links fail migration for reconciliation.
Legacy JSON/search snapshots are invalidated and refilled; they are caches, not identity.
No existing Session or other domain rows are rewritten.

The initial configuration is `CATALOG_PROVIDER=poiskkino-thetvdb`. Search calls PoiskKino only.
Details enrich through a known TheTVDB ID or an IMDb remote-ID lookup; the extended movie must
confirm that IMDb. Missing or ambiguous mappings stay explicit.

| Section                         | Composite precedence                               | Missing data                                                                          |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| English title                   | TheTVDB `eng` translation, then PoiskKino `enName` | `null`; never `name` or an unlabelled `alternativeName`                               |
| English overview                | TheTVDB `eng` overview translation only            | `null`; never a Russian description                                                   |
| Original title                  | Verified normalized source value                   | `null` when adapters cannot establish it                                              |
| Release date and language       | TheTVDB, then verified PoiskKino value             | `null`; a year does not become January 1                                              |
| Release year and runtime        | PoiskKino year; TheTVDB runtime before PoiskKino   | `null` when unknown                                                                   |
| Genres, directors and cast      | TheTVDB English metadata                           | `null` when absent                                                                    |
| Posters, backdrops and trailers | PoiskKino                                          | `null` when absent; allowlisted HTTPS images and YouTube links only                   |
| External ratings                | PoiskKino                                          | An empty list; each known rating retains source, value, scale and optional vote count |
| Similar movies                  | PoiskKino                                          | `null` when absent; external links resolve to Movie UUIDs                             |
| Adult-content flag              | A verified normalized flag                         | `null`; age classification is not an adult flag                                       |

TMDB normalizes into the same fields with TMDB provenance. Images are complete HTTPS URLs;
provider paths and person/genre IDs stay behind the adapter. Unknown values remain nullable.
Poster storage in S3 can be added behind the same URL contract with a configured trusted origin
and a reviewed download/retention policy; no poster or trailer copying is implemented here.

`MovieSourceCache` stores each source's normalized detail snapshot, locale and request-start
clock. `MovieDetailsCache` stores the public projection per provider-configuration/locale key;
`MovieSearchCache` additionally keys normalized query/page and adult-filter policy. Adapter
configuration keys include a merge-policy version, so changing that policy invalidates projections.
Credentials and timeouts belong to adapters; `CATALOG_REFRESH_HOURS` and `CATALOG_STALE_HOURS`
are provider-independent. Only `en-US` is supported initially; unsupported locale input fails
validation instead of entering another locale's cache.

A source removal keeps its external mapping and monotonically advances only that source's
tombstone. A success started strictly after removal can restore it; timestamp ties cannot.
Search never refreshes detail snapshots. Newer primary data cannot renew old enrichment.
The service re-reads saved state and stale candidates to account for concurrent removal.

TheTVDB failures produce explicit provenance and a `partial` primary result. Reusing old
English metadata requires caller opt-in, bounded age and a transient source error, and produces
`stale`. NOT_FOUND, authentication, invalid responses and disabled adapters discard old data.
If PoiskKino is removed but verified TheTVDB data exists, its normalized details remain usable;
no single-source NOT_FOUND marks the Movie UUID globally unavailable.

Catalog writes use a short transaction-level advisory lock to serialize overlapping multi-record
batches. This avoids cross-source/related-title lock inversion and favors correctness at the
initial catalog volume; higher ingestion throughput may require a measured finer-lock design.

### Consequences and alternatives

Switch to `CATALOG_PROVIDER=tmdb` and enable its credentials after filling any missing TMDB
correspondences. Switch back after filling PoiskKino/IMDb correspondences. UUIDs, domain links
and the public contract remain unchanged; only source-specific projections are refilled.

Keeping a nullable TMDB ID on Movie was rejected: a dedicated mapping table treats all sources
consistently. Fuzzy title/year merging was rejected because remakes and localized titles can
refer to different works. English fallback from Russian descriptions was rejected because it
misrepresents locale completeness. All-source global tombstones were rejected because one
provider's removal does not establish another provider's absence.

Live response completeness remains a separate check; synthetic adapter tests verify the
structure and omission rules. Provider attribution/usage rights remain owner work before
public exposure. Queue/worker selection remains separately Proposed in ADR-016.

### Amendment — 2026-10-13: one projection cache

- **Status:** Accepted by the developer in [#172](https://github.com/Shagon1k/PickFlick/issues/172)

The per-source snapshot cache, source removal tombstones, monotonic source clocks and
configuration-key hashing protected against rare provider races at a large code and test cost.
Migration 21 drops `MovieSourceCache` and `MovieExternalId.unavailableAt`. The merged details
projection is the only details cache; the composite fetches both sources whenever it is refreshed.
One freshness rule applies to details and search: data younger than `CATALOG_REFRESH_HOURS` is
served, including `partial` details, and older data is refetched. A transient provider error
returns the cache as `stale` to an opted-in caller while it is younger than
`CATALOG_STALE_HOURS`. A provider `NOT_FOUND` is reported when the cache next refreshes; it no
longer invalidates a fresh cache early. Cache keys hash the configured provider name and locale,
so switching provider starts a separate cache. `Movie.title` and `Movie.releaseYear` hold the
summary used by nominations. The decision table, identity rules and provenance above still apply.

Cache writes are serialized by one advisory lock but no longer compare timestamps, so when two
refreshes of one key race, the one that finishes last wins even if it started first. Each saved
search also refreshes the title and year of the Movies it returns. Both are accepted: a search or
detail result is at most one refresh old, and Movie summaries track the newest provider data.

### API references

- [PoiskKino OpenAPI](https://api.poiskkino.dev/documentation-json)
- [TheTVDB v4 OpenAPI](https://thetvdb.github.io/v4-api/)
- [TMDB movie details](https://developer.themoviedb.org/reference/movie-details)

### Amendment — Display titles, 2026-10-20

Owner verification found real PoiskKino search results with empty `enName` but usable
`alternativeName` or `name`. The display title now prefers these fields in that order after
`enName`; it is not a guarantee of English language. TheTVDB English titles still take precedence
in details, and descriptions remain English-only. Unknown title stays null only when all source
names are empty. This supersedes the English-title missing-data restriction above without using
title/year for Movie identity or adding per-result enrichment requests.

### Amendment — Poster availability, 2026-10-20

The owner verification requests available posters in search and details. Details now prefer the
verified TheTVDB record's poster and fall back to PoiskKino when absent, superseding PoiskKino-only
poster precedence. Yandex image mirrors normalize to the existing canonical host only for their
shared `/get-kinopoisk-image/` paths; the full trusted-image validation remains enforced.
Search metadata still calls PoiskKino only and never downloads images in its response path.
An authenticated lazy poster URL resolves validated active-source search caches and uses the
existing bounded private image ingestion. It does not fan out to detail/enrichment APIs per result.
A cache-policy version invalidates older normalized metadata without changing canonical identities.
Backdrops, trailers and other section rules remain unchanged.

## ADR-018 — Persist Nomination deadline jobs in PostgreSQL

- **Status:** Accepted; implemented for #43
- **Decider:** Developer (Alex), explicit approval in the Kurami recovery conversation on 2026-10-13
- **Date:** 2026-10-12
- **Owning issue:** [#43](https://github.com/Shagon1k/PickFlick/issues/43)
- **Decision context:** first background job under ADR-014; independent of Proposed ADR-016

### Context

Nomination deadlines must survive restarts, duplicate execution, deadline edits, cancellation and
missing scheduling intent. The current runtime has PostgreSQL and Prisma, with no worker or Redis.
ADR-014 requires a queue decision with the first background job. BullMQ with a transactional outbox
remains its default candidate, rather than an accepted implementation choice.

Deadline execution only changes database state. Existing commands already serialize on Club →
Session locks. Using that boundary lets a deadline decision and job completion commit together.

### Decision

Add a Nomination-specific PostgreSQL deadline-job table and a separate worker entrypoint built
from the backend package. Reuse Prisma and existing locking conventions. Add no queue library,
Redis service or generic job framework.

- Add a Session `deadlineVersion`, incremented only when its deadline changes. A job's stable
  identity is `(sessionId, deadlineVersion)`; it stores the expected phase version and deadline.
  Create or replace scheduling intent in the same transaction as Session creation or deadline
  editing. Keep completed intent so an empty deadline is handled only once for that version.
- Select due candidates without holding a job lock, then lock Club → Session → job. Re-read
  phase, lifecycle, deadline and versions under those locks. Concurrent workers must observe the
  committed completion marker before deciding again. This keeps the existing lock order and
  avoids a job → Club deadlock. Each transaction handles one Session without provider calls.
- For accepted participants' nominations, zero leaves Nomination open, one chooses that Movie
  and opens Watching, and two or more open Selection. Count nominations, including repeated
  Movies, rather than distinct Movies. A transition increments phase and details versions and
  clears the deadline, matching operator closure.
- Commit job completion, the automatic decision's audit record and durable notification intent
  together. An empty deadline records operator-alert intent once; successful transitions record
  participant-notification intent. Notification transport and inbox delivery remain later work;
  logs alone do not satisfy durable alert intent.
- Clearing a deadline, cancelling a Session or closing Nomination invalidates its pending intent
  in the same transaction. Workers still guard stale jobs. Unrelated details edits do not reset
  an empty-deadline alert. Archived Clubs stay read-only; their due work remains pending until
  reactivation, without marking the deadline handled.
- On startup and periodically, reconcile overdue Nomination Sessions against matching durable
  intent. Repair missing intent without resetting completed intent, then use the same execution
  path. Emit structured reconciliation, outcome, stale-job and failure events with safe reason
  codes and lateness; omit user text, credentials and invitation material.
- Stop accepting new work on shutdown, finish or roll back the current database transaction,
  and close Prisma. Process death rolls back incomplete work; the next worker retries pending
  intent. No leases or external-delivery retries are needed for this database-only transaction.

### Impact and verification

Implementation adds an additive Prisma migration, Session write integration, deadline services and
tests, and worker startup/shutdown wiring. Local, CI and UAT/preview topology, image commands,
release ordering and operations documentation must include the worker. Production activation
remains unauthorized. Existing nomination visibility, submission UI and manual closure stay intact.

Verify clock-controlled zero/one/many outcomes and stale, duplicate, changed, cleared and cancelled
jobs. Database tests must prove concurrent worker/operator serialization, atomic rollback of the
decision and intent, restart recovery, missing-intent reconciliation and one alert per empty
deadline version. Test archived-Club pause/reactivation, safe logs and shutdown. Apply the additive
migration to fresh and pre-change isolated databases and preserve existing Session data. Run
`pnpm verify`, `pnpm test:integration`, `pnpm deploy:check`, worker image/startup checks and relevant
Session/Nomination smoke checks after implementation.

### Amendment — 2026-10-13: the Session row is the schedule

- **Status:** Accepted by the developer in [#172](https://github.com/Shagon1k/PickFlick/issues/172)

`NominationDeadlineJob` copied `deadlineAt`, `deadlineVersion` and `phaseVersion` from the
Session, and reconciliation existed only to repair job rows the same transaction already wrote.
Migration 22 drops the table and points `NominationDeadlineDecision` at `Session`. The worker
selects Sessions in Nomination whose deadline has passed in an active Club and that have no
decision for their current `deadlineVersion`, then decides each under Club → Session locks. One
decision per deadline version still limits empty-deadline alerts to one per version; clearing,
cancellation and manual closure need no invalidation because the Session itself no longer matches.
Each cycle logs `deadline.cycle` with its due count instead of a reconciliation event.

### Alternatives

- **BullMQ, Redis and transactional outbox:** ADR-014's default candidate; established queue
  tooling, but adds dependencies, a data service and a database-to-queue delivery boundary for a
  transaction that only needs PostgreSQL. Choose this instead if those operational benefits justify
  the additional topology; dependencies and infrastructure need explicit approval.
- **API timer only:** cannot execute while the API is stopped and couples job health to request
  serving. Rejected for this proposal.
- **Reuse the Movie refresh proposal:** ADR-016 is unaccepted and its provider calls need leases
  and retry rules that this database-only job does not. Do not introduce a shared queue framework.

The developer approved this architecture on 2026-10-13. This decision does not claim implemented
deadline behavior or completed issue acceptance.

### Implementation record — 2026-10-13

Migration 18 and the backend deadline worker implement this decision. Automatic audit uses
`NominationDeadlineDecision` because `ClubAuditEvent` requires a human actor; recipients are stored
in `NominationDeadlineNotification` in the same transaction. The worker reuses the database-only
environment schema, polls every five seconds and publishes a private heartbeat for Compose health.
The active phase document records verification evidence. Completion on submission, live progress
and notification transport remain separate work. Production activation is not authorized.

### ADR-018 implementation extension — automatic completion and progress (#44)

Issue #44 reuses the accepted PostgreSQL transaction and Club → Session locking boundary for
automatic completion and a Session-specific progress outbox. The API streams version-only signals
from committed Session state; clients re-fetch their authorized projection after newer versions,
gaps or reconnects. Polling covers unavailable streams. Recipient snapshots retain notification
intent; inbox/email delivery remains later work. No broker, queue library, dispatcher or process
is added. This extends the implementation without changing the accepted deadline-job decision.

## ADR-019 — Distribute notification invalidation through Redis Pub/Sub

- **Status:** Accepted
- **Date:** 2026-10-27
- **Decider:** Owner, [captured approval in PR #197](https://github.com/Shagon1k/PickFlick/pull/197#discussion_r4392323541)
- **Owning issue:** [#61](https://github.com/Shagon1k/PickFlick/issues/61)

### Context

A periodic SSE refresh caused REST inbox requests every five seconds even when nothing changed.
Multiple API instances and browser tabs need prompt notification and read-state invalidation.
PostgreSQL already owns durable notification intent and recipient authorization.

### Decision

Use the official Node Redis client and a concrete publisher/subscriber inside the notification
feature. Publish recipient UUIDs on an environment-scoped Pub/Sub channel only after successful
source transactions or read-state commits. Each API forwards matching signals to all active SSE
connections for that recipient. No notification content, entity data or credentials enter messages.

Keep PostgreSQL authoritative. Clients fetch REST on initial connection, reconnect, focus and
change signals, with five-minute safety reconciliation and coalesced overlapping refreshes.
Thirty-second named heartbeats maintain the connection and recheck authorization without REST
refreshes. Redis loss may lose signals. Bound publishes to 500ms, disable offline publish queuing,
log safe failures and let the official client reconnect and restore subscriptions. A Redis failure
must never roll back or fail a successful domain write.

Add only the client, validated `REDIS_URL`, an ephemeral broker in local/CI/preview/deployment
definitions, and deadline-worker signal wiring. Deployment to shared environments, production
activation, secrets and permissions remain unauthorized. ADR-018's PostgreSQL deadline schedule
is unchanged; Redis provides notification invalidation only.

### Deployment topology amendment — owner approval (2026-10-27)

For PR #197, the owner explicitly approved keeping signal-only Redis inside application Compose
on a separate private network. This is a narrow exception to ADR-007's managed-Redis requirement
and prohibition on Redis in application Compose, not a reversal of its managed-data-service policy.
PostgreSQL remains managed; durable queues, BullMQ or any non-reconstructable Redis state need a
separate accepted durability/managed-service decision before adoption.

Use one project-scoped `notification-signals` network with `internal: true` and no global name.
Only Redis, backend and worker join it. Redis never joins the external `dokploy-network`; backend
and worker keep their existing external connections and aliases. Frontend and release do not join
the private network. Preserve the environment-specific Redis alias and Compose-supplied
`REDIS_URL`; no new manual Dokploy environment value or separately provisioned Redis is required.
Publish no Redis host port or route. Disable snapshots and AOF, configure no persistent volume,
and do not make business startup depend on Redis health. Lost signals are acceptable because REST
and PostgreSQL reconstruct the inbox state. This approval covers repository topology and guidance
only, not provider configuration changes, deployment or production activation.

### Alternatives and limits

- PostgreSQL LISTEN/NOTIFY: explicitly excluded by the owner.
- Unconditional SSE refresh: simple, but generates unnecessary REST traffic and delays updates.
- A generic event framework, Streams, queue, outbox or cache: outside this bounded requirement.

There is no durable broker delivery guarantee. A crash between database commit and publish loses
the signal; initial/reconnect/focus and safety reconciliation recover persisted state. Read APIs,
authorization and safe projection remain independent of Redis.

### Verification

Verify recipient isolation, cross-instance delivery, multiple connections, read-state updates,
no publication on rollback, bounded broker failure and reconnect/resubscription. Browser checks
must cover persistent Club navigation dismissal, reverse Tab after read actions, heartbeat silence
and refresh overlap. Run the repository's static, integration, deployment-definition and selected
UI gates. The active phase document records results; hosted visual acceptance remains separate.
