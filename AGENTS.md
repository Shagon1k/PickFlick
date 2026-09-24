# PickFlick

> Agent operating instructions for this repository. The project is greenfield with executable
> web/API/worker runtime foundations; product behavior is not implemented yet.

## Core Contract

- The human provides intent, constraints, and acceptance criteria. The agent chooses the smallest safe route, executes, and proves the result.
- Deliverables are complete or explicitly blocked. Never claim tests, builds, deployments, reviews, or file changes without evidence.
- If quality, truth, security, privacy, billing correctness, design fidelity, or maintainability is at risk, state the concrete risk and the smallest safer alternative.
- Keep one coherent objective per iteration. Do not mix unrelated refactors or cleanup into feature work.
- Treat `Club`, `Session`, `Selection`, `SessionRating`, and `PersonalMovieRating` as canonical domain names; do not revive legacy “Group” or ambiguous “Vote phase” naming.

## Start Here

- For non-trivial work, read the [documentation map](_docs/README.md) and the artifacts relevant to the change.
- For actionable delivery work, inspect [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) and read [.agent-docs/rules/github-issues.md](.agent-docs/rules/github-issues.md).
- For GitHub task routing, Project 3 workflow, and run authorization, read [.agent-docs/rules/github-issues.md](.agent-docs/rules/github-issues.md).
- Inspect `git status --short` before editing and preserve unrelated user changes.
- Before frontend work, inspect the canonical screen, [_docs/design/prototypes/DESIGN.md](_docs/design/prototypes/DESIGN.md), the [responsive baseline](_docs/design/prototypes/responsive-baselines.html), and [DESIGN.md](DESIGN.md).
- Before domain/API/worker work, inspect [ROADMAP.md](ROADMAP.md) business/state rules and [ARCHITECTURE.md](ARCHITECTURE.md) boundaries.
- For changes touching more than 5 files or roughly 100 lines, present a short impact/verification plan and obtain approval unless an already-approved phase/task clearly covers that breadth.
- Group genuine requirement questions. If a safe, reversible assumption does not change product scope, state it and proceed.

## Current Repository State

- The typed pnpm workspace, web/API/worker entrypoints, focused internal packages, local
  PostgreSQL/Redis/MinIO stack, typed storage/Resend configuration, and baseline quality commands
  are executable. Production-oriented web/API/worker/release images and the proportional,
  source-built UAT/production application Compose topology are also executable locally. The
  exact-revision UAT workflow and operator guide are implemented; live Dokploy/Cloudflare
  provisioning and UAT evidence remain owner-run Phase 1 work. The guarded manual production
  promotion workflow and runbook are also implemented; the production guard remains false, and no
  production provisioning, deployment, or traffic cutover is authorized.
- `packages/database` owns the initial `User`, `Club`, `Membership`, and `Session` Prisma schema,
  the Contact delivery intent, five reviewed migrations, deterministic synthetic fixtures, and
  guarded local/test seed and reset commands. Remaining product entities arrive with their owning
  phases.
- Proposed architecture is not Active implementation. Approve significant choices through the ADR registry before scaffolding makes them expensive to change.
- The HTML prototypes are inspectable design specifications and disposable implementation examples; do not copy their inline JavaScript, fixture data, or page-local CSS into production uncritically.

## Command Map

Use the Node and pnpm versions pinned by `.node-version` and `package.json` from the repository root.

| Task | Command |
| --- | --- |
| Install dependencies | `pnpm install --frozen-lockfile` |
| Start local data services and create the object-storage bucket | `pnpm services:up` |
| Check local PostgreSQL, Redis, and object storage | `pnpm services:check` |
| Stop local data services and retain their volumes | `pnpm services:down` |
| Start web, API, and worker in development | `pnpm dev` |
| Start previously built production entrypoints | `pnpm start` |
| Validate workspace topology and dependency boundaries | `pnpm check:workspace` |
| Lint | `pnpm lint` |
| Type-check | `pnpm typecheck` |
| Run unit tests | `pnpm test` |
| Build every package and app | `pnpm build` |
| Run component accessibility, interaction, viewport, and visual checks | `pnpm ui:test` |
| Update reviewed component screenshot baselines | `pnpm ui:test:update` |
| Smoke built web, API, and worker entrypoints | `pnpm e2e:smoke` |
| Build the four production image targets | `pnpm images:build` |
| Validate isolated UAT/production Compose renders | `pnpm compose:check` |
| Run the release gate, then converge the deployment | `pnpm deploy:compose` |
| Deploy and wait for the configured exact UAT revision | `pnpm uat:deploy` |
| Run desktop/mobile UAT browser smoke and screenshots | `pnpm uat:smoke` |
| Prepare or execute the guarded production promotion controller | `pnpm production:promote -- <prepare\|deploy>` |
| Run all scaffold quality gates | `pnpm verify` |
| Apply database migrations | `pnpm migrate` |
| Run the database seed | `pnpm seed` |
| Verify migrations, fixtures, and database constraints | `pnpm db:check` |
| Verify Contact persistence, duplicate handling, and rate limits | `pnpm contact:check` |
| Verify Club policies, role transitions, entitlements, and audit records | `pnpm club:check` |
| Reset a positively identified local/test database | `pnpm db:reset` |

Copy `.env.example` to `.env` before running services or runtime commands. See
[_docs/environment.md](_docs/environment.md) for the variable inventory and destructive-reset
safeguards.

## Phase Workflow

- Before starting a Roadmap phase, create or confirm its focused Project 3 issues, then create `_docs/phase-N-short-name.md` and link it from `_docs/README.md` while active.
- The phase document owns temporary implementation detail: dependencies, inherited behavior, shims/removals, exact subtasks, edge cases, commands, and evidence in progress.
- It links owning issues but does not duplicate their live status. It must not replace Roadmap scope/acceptance, Design behavior, Architecture boundaries, or accepted ADR rationale.
- At phase completion, consolidate durable knowledge into canonical guidance, record evidence/progress in `ROADMAP.md`, then delete the temporary phase document and its docs-map link.
- Human Verification & Bug Fixing phases occur after each five-phase delivery block. They require a severity-classified issue register; resolve all Blockers/Majors before continuing and record every lower-severity deferral explicitly.
- Stabilization gates supplement normal per-phase tests and checks; never defer ordinary quality work to the next gate.

## Rule Index

- Git branches, commits, PRs, and worktree safety: [.agent-docs/rules/git.md](.agent-docs/rules/git.md)
- GitHub issue creation, Project statuses, routing, and phase linkage: [.agent-docs/rules/github-issues.md](.agent-docs/rules/github-issues.md)

## Execution Loop

```text
understand -> inspect source authority -> choose smallest useful move -> edit -> verify -> update guidance -> report evidence
```

- Prefer direct, readable implementation over premature abstraction.
- Add a dependency only with developer approval and a concrete requirement; prefer existing dependencies, platform APIs, or the standard library.
- If evidence is inconclusive, perform one stronger confirming check before concluding.
- Verify the affected layer: focused tests for logic, integration tests for boundaries, and visual/accessibility checks for UI.
- After a CLI scaffold, audit every generated file before keeping it.

## Product Invariants

These rules are high-risk and require database/server enforcement plus focused tests:

- Registered users only; Google and Apple are the MVP identity providers.
- App roles are User and App Admin only. Club roles are Admin, Moderator, and Member.
- One Club may have at most one Session in Nomination, Selection, or Watching; Rating Sessions are non-blocking and unlimited.
- Automatic phase transitions are idempotent and serialized. Watching moves to Rating manually.
- Session invitations disclose nothing to non-members and never create Club membership.
- Selection score range is inclusive with a Club-configured upper bound no greater than 10. New Clubs
  start at `0`; the data model still accepts a stored `1` start, which existing Clubs keep.
- Historical Session Ratings are separate from editable Personal Ratings.
- Account deletion anonymizes shared history; it does not erase other members’ Club/Session records.
- Billing webhooks, background jobs, exports, ownership changes, suspension, and destructive actions are idempotent/audited where applicable.

## Frontend & Design Rules

- Canonical visual/behavior authority is the self-contained package under `_docs/design/prototypes`; the production-ready image inventory is under `assets/brand`.
- Build Projector Noir through shared tokens/components. Do not hard-code near-duplicate values per screen.
- Mobile is a first-class recomposition. Avoid horizontal page scrolling; bound table scrolling locally.
- Mouse, keyboard, and touch must work. Preserve visible focus, semantic control names, dialog focus trap/return, live feedback, 44px touch targets, and reduced motion.
- Implement applicable loading, empty, validation, error, unauthorized, read-only, offline, success, and destructive-confirmation states.
- Do not bake new user-facing text into image assets. `panda-invited-2.webp` already contains English text and must be used only where that limitation is acceptable.
- Fixture film images/content do not establish licensing, provider identifiers, business rules, roles, billing plans, or production copy.

## Code, Data & Safety Rules

- Match surrounding conventions once code exists; write minimal, typed, readable code.
- Keep growing modules readable by separating reusable types, errors, validation, persistence, and
  provider adapters when those concerns would otherwise obscure the owning workflow.
- Names carry meaning. Do not use one term for different concepts or multiple terms for the same concept.
- Validate untrusted browser/provider/file/webhook input at boundaries and encode user/provider output contextually.
- Enforce authorization at the server/data boundary; hidden UI is never a permission boundary.
- Never hardcode or log secrets, tokens, credentials, raw invitation URLs, private keys, or unnecessary personal data.
- New environment variables must enter `.env.example`, typed startup validation, and the environment inventory in the same change.
- Never swallow errors or hide failure behind silent fallback. Surface, handle, retry, or log/rethrow intentionally.
- Treat migrations, data deletion/anonymization, auth, billing, ownership, role changes, exports, and retention as high-risk; use stronger review and evidence.
- Structural refactors require approval and should be separate from behavior changes. Small necessary cleanup within touched code is fine.

## Git & Worktree

- Branch naming: `PF-type-short-kebab-descriptor` unless the repository later adopts a different documented convention.
- Use Conventional Commits and squash merge through a PR.
- Link every delivery PR to its owning Project 3 issue.
- One logical change per commit. Commit, push, and PR authorization for owner-started
  Project 3 runs follows `.agent-docs/rules/github-issues.md`. Outside that narrow
  issue-scoped exception, never commit, push, or open a PR without explicit developer
  approval.
- Never reset, revert, overwrite, or delete user work unless explicitly requested and exact targets are verified.

## Project Documentation

Guidance is part of implementation. Update every affected artifact in the same task.

| Artifact | Owns | Update when the task changes |
| --- | --- | --- |
| [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) | Actionable active/deferred delivery issues and live task status. | Work is created, selected, started, deferred, sent to review, completed, or reprioritized. |
| [ROADMAP.md](ROADMAP.md) | Product scope, business rules, routes, phase sequence/status/evidence, and product Decision Log. | Scope, behavior, limits, phase acceptance/status, or a durable product decision changes. |
| [DESIGN.md](DESIGN.md) | Experience direction, sources, screens/states, components, responsive/accessibility contract, design QA. | Visible behavior/content, design foundations, component/state coverage, or QA status. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Deployables/modules, data/interface ownership, integrations, runtime, security/reliability/operations. | A boundary, dependency, schema/interface workflow, integration, environment, deployment, or guarantee. |
| [_docs/decisions/README.md](_docs/decisions/README.md) | Durable rationale and supersession for significant technical choices. | A meaningful alternative is accepted, rejected, superseded, or materially revisited. |

Documentation impact check after implementation:

1. Update the owning Project issue and every affected artifact before reporting completion.
2. Mark Roadmap work Done only with the acceptance evidence it requests.
3. Describe verified implementation as Active/current and unimplemented direction as Proposed.
4. Append/supersede accepted ADR history; never rewrite it to hide a changed decision.
5. If no artifact is affected, report `Documentation impact: none` and one short reason.

Do not copy issue lists or task status into Roadmap prose. Project 3 owns actionable work status;
Roadmap owns phase-level product acceptance and evidence.

## Reporting Back

Final reports include:

- outcome and files changed;
- owning issue and resulting Project status;
- checks run and their results;
- documentation impact;
- anything not verified;
- blockers or follow-up only when relevant.

If blocked, report the blocker, attempted work, evidence, and the smallest decision/access needed next.
