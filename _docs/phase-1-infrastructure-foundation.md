# Phase 1 — Infrastructure, Repository & Deployment Foundation

> Temporary implementation plan for Phase 1. Project 3 owns live issue status; this document owns
> cross-issue sequencing, inherited contracts, edge cases, commands as they become real, and
> phase-level evidence in progress.

## Outcome

Create a reproducible monorepo/runtime foundation, prove the exact built revision through automatic
UAT delivery, and prepare a production-promotion path that cannot deploy while its explicit guard is
false.

The accepted technical direction is recorded in
[ADR-001 through ADR-006](decisions/README.md). Code, configuration, services, and environments remain
`Proposed` until their owning issues provide verification.

## Owning issues

| Slice | Issue | Phase contribution |
| --- | --- | --- |
| 1.1 | [#9 — Approve the Phase 1 architecture and ADR baseline](https://github.com/Shagon1k/PickFlick/issues/9) | Accept the compatible technical direction before scaffolding. |
| 1.2 | [#10 — Scaffold the typed pnpm monorepo and executable command map](https://github.com/Shagon1k/PickFlick/issues/10) | Create audited web, API, worker, contracts, database, UI, and configuration workspaces. |
| 1.3 | [#11 — Establish local data services, migrations, seeds, and typed configuration](https://github.com/Shagon1k/PickFlick/issues/11) | Prove local PostgreSQL, Redis, object storage, mail, migration, seed, and environment boundaries. |
| 1.4 | [#12 — Add health, readiness, structured logging, correlation, and stable API errors](https://github.com/Shagon1k/PickFlick/issues/12) | Make the runtime observable and safe to probe. |
| 1.5 | [#13 — Build production images and the shared UAT/production Compose topology](https://github.com/Shagon1k/PickFlick/issues/13) | Build immutable deployables and the isolated environment topology. |
| 1.6 | [#14 — Replace placeholder CI with reproducible quality gates](https://github.com/Shagon1k/PickFlick/issues/14) | Run the real command and artifact gates from a clean checkout. |
| 1.7 | [#15 — Provision isolated UAT and automatic exact-revision delivery](https://github.com/Shagon1k/PickFlick/issues/15) | Deploy and verify the exact green `main` artifact in UAT. |
| 1.8 | [#16 — Prepare guarded production promotion and deployment runbooks](https://github.com/Shagon1k/PickFlick/issues/16) | Prove promotion validation while production deployment remains disabled. |

Do not copy Project status or Priority into this file. Read Project 3 before starting each slice.

## Accepted foundation

| Boundary | Accepted contract | ADR |
| --- | --- | --- |
| Repository | One pnpm modular monorepo; separate web, API, and worker runtime entrypoints; focused internal packages only. | [ADR-001](decisions/README.md#adr-001--use-a-pnpm-modular-monorepo-with-three-runtime-entrypoints) |
| Authentication | Same-origin routes; NestJS API owns OAuth, opaque server sessions, revocation, CSRF, and authorization. The library remains issue #25 work. | [ADR-002](decisions/README.md#adr-002--keep-authentication-and-sessions-at-the-api-boundary) |
| Database | PostgreSQL through a pinned stable Prisma client and committed reviewed migrations; explicit SQL enforces unsupported/high-risk constraints. | [ADR-003](decisions/README.md#adr-003--use-postgresql-and-reviewed-prisma-migrations) |
| Async | PostgreSQL transaction commits domain state plus outbox intent; BullMQ/Redis executes at-least-once idempotent jobs; reconciliation repairs gaps. | [ADR-004](decisions/README.md#adr-004--use-bullmq-with-a-transactional-outbox) |
| Deployment | Immutable images promoted by digest; isolated Dokploy UAT/production environments; Cloudflare/Traefik ingress; production guard false. | [ADR-005](decisions/README.md#adr-005--deploy-immutable-images-through-isolated-dokploy-environments) |
| UI | Project-owned Projector Noir CSS tokens/components; native HTML first; wrapped selective Mantine behavior primitives. | [ADR-006](decisions/README.md#adr-006--own-projector-noir-and-use-mantine-selectively) |

## Sequence and dependencies

1. Complete the accepted ADR and canonical-document alignment in #9.
2. Scaffold only the packages and commands required by #10; audit every generated file before
   keeping it.
3. Add isolated local data/configuration and migration evidence in #11.
4. Add runtime health, errors, logs, and correlation in #12 before deployment automation depends on
   probes.
5. Build immutable images and the shared parameterized Compose shape in #13.
6. Make CI reproduce the clean-checkout gates and image evidence in #14.
7. Provision UAT and verify exact-revision automatic delivery in #15 after DNS control is available.
8. Add and test the dormant production-promotion path and runbooks in #16.

A later slice may start early only when its prerequisites already have evidence and the resulting
change remains independently reviewable. Never weaken an earlier gate to run work in parallel.

## Cross-slice contracts

### Repository and dependency rules

- Pin the runtime, package manager, and direct dependency versions in machine-readable files during
  scaffolding. Do not copy version inventories into canonical prose.
- Use `workspace:` for internal packages and fail verification on workspace dependency cycles.
- Keep apps independently buildable and runnable. Do not import one app entrypoint from another.
- Extract shared server-side behavior only when API and worker have a real common consumer.
- Add no dependency without developer approval and a concrete requirement.

### Configuration and secrets

- Add every environment variable to `.env.example`, typed startup validation, and the environment
  inventory in the same slice.
- Distinguish build-time public values from runtime secrets. Public web variables must never carry
  server credentials.
- Fail startup on missing or invalid required configuration without printing secret values.
- Give local, test, UAT, and production separate database, Redis, storage, OAuth, email, billing,
  and session namespaces/credentials as applicable.

### Database and release safety

- Use `migrate dev` only on disposable developer databases and `migrate deploy` for CI/UAT/release.
- Never use `db push` as an environment deployment path.
- Guard destructive reset/seed behavior with positive non-production identification.
- Create the one-blocking-Session partial unique index through reviewed PostgreSQL migration SQL.
- Run release migration/required seed work before application activation. Preserve the previous
  revision when the release job fails.
- State whether each migration is backward compatible with the previously deployable image.

### Jobs and shutdown

- Treat queue delivery as at least once; use stable identifiers and idempotent consumers.
- Reload PostgreSQL state before acting on Session deadlines or provider events.
- Bound retries, retain observable terminal failure, and test reconciliation after a lost dispatch.
- Stop accepting new work during shutdown and give active jobs a documented bounded drain window.
  Select the numeric window only with runtime evidence; do not invent it in planning.

### Network and environment isolation

- Route public requests through Cloudflare and Dokploy/Traefik. Do not publish application,
  PostgreSQL, Redis, or object-storage ports directly.
- Trust forwarded client identity only from the configured proxy chain.
- Keep UAT and production in separate Dokploy projects, deployment servers by default, networks,
  volumes, data stores, buckets, and service identities.
- Verify SSE is not buffered across the full Cloudflare/Traefik/API path.
- Build once and promote by immutable digest. Report both source revision and deployed digest.
- Keep the production-enable guard false throughout Phase 1.

## Required edge-case evidence

| Risk | Evidence required before Phase 1 completion |
| --- | --- |
| Clean-machine drift | A clean checkout uses the documented pinned toolchain and succeeds without undeclared local state. |
| Generated-file noise | Repository-tree audit records which scaffolded files were kept or removed and why. |
| Configuration leak | Invalid/missing configuration fails safely; logs and built browser assets contain no secret values. |
| Migration failure | A deliberately failing release migration/seed leaves the prior revision active. |
| Database reset misuse | Reset refuses an environment that is not positively identified as local/test. |
| Cross-environment access | UAT identities and network paths cannot address production data services or storage scopes. |
| Duplicate job | Re-running the same representative job leaves one correct domain/external outcome. |
| Stale deadline | A job with an obsolete Session phase/deadline/version performs no transition. |
| Lost dispatch | Reconciliation republishes committed pending outbox intent safely. |
| Proxy identity | The API accepts forwarded identity only through the trusted proxy path. |
| SSE buffering | A production-shaped UAT stream delivers incremental events and reconnects to authoritative state. |
| Artifact mismatch | UAT reports the expected source revision and immutable image digest. |
| Rollback incompatibility | Deployment refuses or documents a rollback that the applied schema cannot support. |
| Production guard | Manual promotion validates its inputs but cannot deploy while the guard is false. |

## Command map

Issue #10 established the first executable command map. `AGENTS.md` owns the durable list.

| Capability | Root command | Current boundary |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | Uses the committed lockfile and pinned Node/pnpm versions. |
| Develop/start | `pnpm dev` / `pnpm start` | Runs the web, API, and worker scaffold entrypoints. |
| Static and unit gates | `pnpm lint`, `pnpm typecheck`, `pnpm test` | Covers the current scaffold. |
| Build and full verification | `pnpm build`, `pnpm verify` | Builds all workspaces and rejects invalid workspace boundaries/cycles. |
| Local services | `pnpm services:up`, `pnpm services:check`, `pnpm services:down` | Starts and checks loopback-only PostgreSQL, Redis, MinIO, and Mailpit services. |
| Database migration/seed | `pnpm migrate`, `pnpm seed`, `pnpm db:check` | Applies reviewed Prisma migrations, deterministic local/test fixtures, and constraint/upgrade checks. |

Later Phase 1 issues add real database changes, image, Compose, deployment, and smoke commands when
those capabilities exist. Never treat a zero-change database plan as migration or seed integration
evidence.

## Evidence register

| Evidence | State | Location / remainder |
| --- | --- | --- |
| Compatible architecture comparison and developer approval | Verified | [ADR registry](decisions/README.md), accepted 2026-09-05. |
| Canonical architecture alignment | In progress | Issue #9 documentation change. |
| Runnable monorepo and command map | Verified locally | Clean source-only export of issue #10 branch: frozen locked install with a fresh store; workspace-boundary check; lint; type-check; 7 unit tests; web/API/worker production builds and startup probes. |
| Local data, migrations, seeds, typed configuration | Verified locally | Issue #11 branch: Compose readiness for PostgreSQL/Redis/MinIO/Mailpit; two fresh migrations; repeated idempotent seed; migration-upgrade, partial-index, score-range, service-connectivity, and safe-config tests. |
| Health/readiness/logging/error baseline | Missing | Issue #12. |
| Immutable images and isolated Compose topology | Missing | Issue #13. |
| Reproducible CI gates | Missing | Issue #14. |
| Exact-revision UAT deployment and smoke evidence | Missing | Issue #15. |
| Disabled production-promotion path and runbooks | Missing | Issue #16. |

Phase 1 remains incomplete until every Roadmap acceptance check has linked evidence. Do not defer
ordinary tests or safety work to the Phase 6 stabilization gate.

## Documentation lifecycle

Update canonical guidance in the same slice when implementation changes its owned contract:

- `ARCHITECTURE.md` for runtime, data, interface, integration, or deployment boundaries;
- `ROADMAP.md` for product/phase scope, acceptance, phase status, or product decisions;
- `DESIGN.md` for visible behavior, component/state coverage, or design QA;
- `_docs/decisions/README.md` when a significant accepted choice is revisited;
- `AGENTS.md` for verified commands or agent workflow.

At Phase 1 completion, consolidate durable commands and operational facts into their canonical
guides, record phase evidence in `ROADMAP.md`, remove this file, and remove its docs-map link.

## Out of scope

- End-user feature implementation or production UI.
- Production traffic cutover or real production user data.
- Activating live billing, email, or OAuth providers.
- Choosing the auth/session library before issue #25.
- Final retention, backup duration, regional-loss, legal, or production Go/No-Go decisions.
