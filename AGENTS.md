# PickFlick

## Simplicity and scope

Implement the requested behavior with the simplest clear solution that fits the existing codebase. Optimize for maintainers reading and changing the code, not for hypothetical future requirements.

- Prefer straightforward control flow, concrete functions, and existing conventions. Add abstractions only when they simplify a current requirement or remove meaningful existing duplication.
- Do not introduce generic frameworks, extension points, configuration, dependencies, or extra layers for a single bounded use case unless current requirements justify them.
- Handle expected failures and validate untrusted input at system boundaries. Inside trusted code, rely on established contracts instead of repeating defensive checks.
- Add retries, fallbacks, recovery paths, and compatibility behavior only for an identified requirement or a demonstrated failure mode. Prefer a clear, actionable error over speculative recovery.
- Match edge-case handling to both likelihood and impact. Do not add substantial complexity for low-impact hypothetical cases. Preserve security, authorization, data integrity, and explicit acceptance requirements.
- Keep changes focused. Do not combine the task with unrelated cleanup, restructuring, or future-proofing.
- Test required behavior, meaningful failure paths, and observed regressions. Do not invent new product requirements merely to cover more cases.

For non-trivial changes, briefly state the simplest approach, what existing code it reuses, and what is intentionally out of scope. Do not create a separate design document or wait for additional approval unless a material trade-off or repository-specific rule requires it.

Before finishing, remove unnecessary indirection, redundant checks, and speculative branches introduced by your change. If a rare case would require disproportionate complexity, disclose the limitation rather than silently expanding the implementation. Simplicity means fewer unnecessary mechanisms, not compressed or cryptic code.

These guidelines do not override repository-specific approval requirements, architecture constraints, or verification gates.

> Operating instructions for agents in this repository. Phases 1–5 and 7–10 (foundations through
> Sessions and Nomination) are built and await their verification gates; Phase 11 is in progress.

## Core contract

- The human gives intent, constraints, and acceptance criteria. You choose the smallest safe route,
  do the work, and prove the result.
- Deliver complete work or say exactly what blocks it. Never claim a test, build, deployment, review,
  or file change without evidence.
- When quality, truth, security, privacy, billing, design fidelity, or maintainability is at risk,
  name the risk and the smallest safer alternative.
- Keep one objective per iteration; do not mix unrelated refactors into feature work.
- Use the domain names `Club`, `Session`, `Selection`, `SessionRating`, and `PersonalMovieRating`.
  Never revive "Group" or "Vote phase".

## Start here

- For non-trivial work, read the [documentation map](_docs/README.md) and the documents your change
  touches.
- For delivery work, check [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) and
  [.agent-docs/rules/github-issues.md](.agent-docs/rules/github-issues.md), which also covers run
  authorization.
- Run `git status --short` before editing and keep unrelated user changes.
- Before frontend work, open the canonical screen, the
  [design contract](_docs/design/prototypes/DESIGN.md), the
  [responsive baseline](_docs/design/prototypes/responsive-baselines.html), and [DESIGN.md](DESIGN.md).
- Before domain or backend work, read the [Roadmap business rules](ROADMAP.md#3-business-rules) and
  [ARCHITECTURE.md](ARCHITECTURE.md). Before touching auth, headers, input handling, or secrets,
  read [Security](_docs/security.md).
- For a change over 5 files or about 100 lines, present a short impact and verification plan and get
  approval, unless an approved phase or task already covers it.
- Group real requirement questions. When a safe, reversible assumption does not change scope, state
  it and proceed.

## Repository state

- A pnpm workspace with `apps/frontend` (Next.js) and `apps/backend` (NestJS), plus
  `packages/contracts` (zod schemas), `packages/database` (Prisma), and `packages/config`
  (environment schema, TypeScript and ESLint presets). The backend package includes a Nomination
  deadline worker that reads due deadlines from the Session rows
  ([ADR-018](_docs/decisions/README.md#adr-018--persist-nomination-deadline-jobs-in-postgresql));
  no Redis or queue library is used.
- The schema holds Users, auth sessions and provider accounts, Clubs, Memberships, Club invitations and
  audit events, the movie catalog cache, and Sessions with participants, invitations, and
  Nominations, Selection ballots and frozen winner snapshots across twenty-five migrations.
- UAT deploys automatically after CI on `main`. Production promotion exists but is guarded off
  (`PRODUCTION_DEPLOY_ENABLED` is false); production provisioning, deployment, and traffic are not
  authorized.
- Proposed architecture is not implemented. Approve significant choices through the ADR registry
  before code makes them expensive to change.
- The HTML prototypes are design specifications. Do not copy their JavaScript, fixture data, or
  page-local CSS into production.

## Commands

Run from the repository root with the Node and pnpm versions pinned in `.node-version` and
`package.json`. Copy `.env.example` to `.env` first.

Scripts are named `area:action`; the area says what they touch.

| Area     | Command                                                 | Does                                                                   |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Setup    | `pnpm install --frozen-lockfile`                        | Install the locked dependencies.                                       |
| Services | `pnpm services:up` / `services:check` / `services:down` | Start, check, or stop local PostgreSQL and MinIO (volumes are kept).   |
| Run      | `pnpm dev` / `pnpm start`                               | Run the frontend and backend in development, or the built ones.        |
| Quality  | `pnpm lint` / `lint:fix`                                | ESLint and Stylelint (the house style), or their autofixes.            |
|          | `pnpm format` / `format:check`                          | Format with Prettier, or check formatting.                             |
|          | `pnpm typecheck`                                        | Type-check every package, the tests, and the configs.                  |
|          | `pnpm knip`                                             | Find unused files, exports, and dependencies.                          |
|          | `pnpm verify`                                           | All of the above, unit tests, and the build: the static CI gate.       |
| Test     | `pnpm test:unit`                                        | Vitest unit tests.                                                     |
|          | `pnpm test:integration`                                 | Database and API tests against the local services.                     |
|          | `pnpm test:ui:smoke`                                    | Tagged PR behavior checks.                                             |
|          | `pnpm test:ui:contract` / `test:ui:visual`              | Full behavior checks, or release screenshot comparisons.               |
|          | `pnpm test:ui` / `test:ui:update`                       | Both UI selections, or update visual baselines after review.           |
|          | `pnpm test:e2e`                                         | Smoke the built frontend and backend against isolated services.        |
|          | `pnpm test:journeys`                                    | Core flows through the built web app and real API on `pickflick_test`. |
|          | `pnpm test:uat`                                         | Smoke a deployed environment (`PLAYWRIGHT_BASE_URL`).                  |
| Build    | `pnpm build` / `build:packages` / `build:images`        | Build everything, only the shared packages, or the production images.  |
| Deploy   | `pnpm deploy:check`                                     | Render the local, deploy, and preview Compose files.                   |
|          | `pnpm deploy:uat`                                       | Converge UAT Compose from a clean checkout.                            |
| Database | `pnpm db:migrate` / `db:seed`                           | Apply the migrations, or load local or test seed data.                 |
|          | `pnpm db:reset`                                         | Reset a positively identified local or test database.                  |

UAT deployment and production promotion run only in GitHub Actions (`deploy-uat.yml`,
`promote-production.yml`). [\_docs/environment.md](_docs/environment.md) lists variables and reset
safeguards.

## Phase workflow

- Before a Roadmap phase starts, create or confirm its Project 3 issues, then create
  `_docs/phase-N-short-name.md` and link it from `_docs/README.md` while the phase is active.
- The phase document holds temporary detail: dependencies, inherited behavior, shims, subtasks, edge
  cases, commands, and evidence in progress. It links issues without copying their status and never
  replaces Roadmap acceptance, Design behavior, Architecture boundaries, or ADR rationale.
- When the phase ends, move durable knowledge into canonical documents, record evidence in
  `ROADMAP.md`, and delete the phase document and its link.
- A Human Verification & Bug Fixing phase follows every five delivery phases. It keeps a
  severity-classified register; fix every Blocker and Major before continuing and record each
  lower-severity deferral.
- Verification gates add to normal per-phase tests; never push ordinary quality work to the next
  gate.

## Code style

Write code that looks like the code around it and like TailorTales: obvious, short, and built on
well-known libraries. `pnpm lint` enforces what it can; the rule files hold the details.

- No speculative code: no feature, option, lock, or retry without a current caller or a real risk.
- Validate input with zod schemas from `@pickflick/contracts`; throw Nest exceptions from services.
- Interfaces are `IName`, type aliases `TName`; no `Readonly<>`; optional fields are `field?: T`.
- UI components are `components/ui/<Name>/<Name>.tsx` with `<Name>.module.scss`, a default export,
  and Mantine underneath. Only the UI kit imports `@mantine/*` (except `@mantine/form`).
- Routes keep their styles and `_components/` next to `page.tsx`; import through the `#` folder
  aliases (`#components/...`).
- Comment why, never what.
- [Add a feature end to end](_docs/adding-a-feature.md) walks through every layer. Templates to
  copy: backend module `apps/backend/src/modules/contact`, UI component
  `apps/frontend/src/components/ui/Button`, route `apps/frontend/src/app/(auth)/login`, form
  `apps/frontend/src/app/(marketing)/contact/_components/ContactForm`.

## Rule index

- TypeScript, naming, validation, scope: [.agent-docs/rules/typescript.md](.agent-docs/rules/typescript.md)
- CSS Modules and Mantine: [.agent-docs/rules/frontend-css.md](.agent-docs/rules/frontend-css.md)
- Tests: [.agent-docs/rules/testing.md](.agent-docs/rules/testing.md)
- Backend structure: [apps/backend/AGENTS.md](apps/backend/AGENTS.md)
- Frontend structure: [apps/frontend/AGENTS.md](apps/frontend/AGENTS.md)
- Git branches, commits, PRs, worktrees: [.agent-docs/rules/git.md](.agent-docs/rules/git.md)
- GitHub issues, Project statuses, phase linkage: [.agent-docs/rules/github-issues.md](.agent-docs/rules/github-issues.md)

## Working loop

```text
understand -> read the source of truth -> choose the smallest useful move -> edit -> verify -> update docs -> report evidence
```

- Prefer direct, readable code over early abstraction.
- Add a dependency only with developer approval and a concrete need; prefer what already exists.
- When evidence is inconclusive, run one stronger check before concluding.
- Verify the layer you changed: focused tests for logic, integration tests for boundaries, visual and
  accessibility checks for UI.
- After a CLI scaffold, audit every generated file before keeping it.

## Product invariants

These need database or server enforcement and focused tests:

- Registered users only; Google and Apple are the MVP identity providers.
- App roles are User and App Admin; Club roles are Admin, Moderator, and Member.
- A Club has at most one Session in Nomination, Selection, or Watching; Rating Sessions are
  unlimited and non-blocking.
- Automatic phase transitions are idempotent and serialized; Watching moves to Rating by hand.
- Session invitations disclose nothing to non-members and never create Club membership.
- The Selection scale is inclusive with a Club-set upper bound of at most 10. New Clubs start at
  `0`; the data model still accepts a stored `1` start, which existing Clubs keep.
- Historical Session Ratings are separate from editable Personal Ratings.
- Account deletion anonymizes shared history; it never erases other members' Club or Session
  records.
- Billing webhooks, background jobs, exports, ownership changes, suspension, and destructive actions
  are idempotent and audited where applicable.

## Frontend and design rules

- The package under `_docs/design/prototypes` is the visual and behavior authority; production
  images live in `assets/brand`.
- Build Projector Noir through shared tokens and components; never hard-code near-duplicate values.
- Mobile is recomposed, not shrunk. No horizontal page scrolling; tables scroll locally.
- Mouse, keyboard, and touch all work. Keep visible focus, semantic names, dialog focus trap and
  return, live feedback, 44px targets, and reduced motion.
- Implement the applicable loading, empty, validation, error, unauthorized, read-only, offline,
  success, and destructive-confirmation states.
- Bake no new user-facing text into images. `panda-invited-2.webp` already has English text; use it
  only where that is acceptable.
- Fixture film images and content establish no licensing, provider IDs, rules, roles, plans, or copy.

## Code, data, and safety rules

- Keep growing modules readable by separating types, errors, validation, persistence, and provider
  adapters when they would otherwise hide the workflow.
- One name per concept, one concept per name.
- Validate untrusted browser, provider, file, and webhook input at the boundary; encode output for
  its context.
- Enforce authorization on the server and in data access; hidden UI is never a permission boundary.
- Never hard-code or log secrets, tokens, credentials, raw invitation URLs, private keys, or
  unnecessary personal data.
- A new environment variable goes into `.env.example`, the zod schema, and the environment
  reference in the same change.
- Never swallow errors or hide failure behind a silent fallback: handle, retry, or log and rethrow.
- Treat migrations, deletion and anonymization, auth, billing, ownership, roles, exports, and
  retention as high-risk and bring stronger evidence.
- Structural refactors need approval and stay separate from behavior changes. Small cleanup inside
  code you touch is fine.

## Git

- Branches are `PF-type-short-kebab-descriptor`.
- Use Conventional Commits, one logical change per commit, and squash merge through a PR linked to
  its Project 3 issue.
- Commit, push, and PR authorization for owner-started Project 3 runs follows
  `.agent-docs/rules/github-issues.md`. Otherwise never commit, push, or open a PR without explicit
  developer approval.
- Never reset, revert, overwrite, or delete user work unless asked and the exact targets are
  verified.

## Project Documentation

Documentation is part of the change. Update every affected document in the same task.

| Document                                                         | Owns                                                                                   | Update when                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) | Actionable issues and their live status.                                               | Work is created, started, deferred, sent to review, completed, or reprioritized.   |
| [ROADMAP.md](ROADMAP.md)                                         | Scope, business rules, routes, phases and their evidence, the Decision Log.            | Scope, behavior, limits, phase status, or a durable product decision changes.      |
| [DESIGN.md](DESIGN.md)                                           | Experience direction, screens and states, components, responsive and accessibility QA. | Visible behavior, design foundations, component coverage, or QA status changes.    |
| [ARCHITECTURE.md](ARCHITECTURE.md)                               | Deployables, modules, data, interfaces, integrations, runtime, operations.             | A boundary, dependency, interface, integration, environment, or guarantee changes. |
| [ADR registry](_docs/decisions/README.md)                        | Rationale and supersession of significant technical choices.                           | An alternative is accepted, rejected, superseded, or revisited.                    |

After implementing:

1. Update the Project issue and every affected document before reporting completion.
2. Mark Roadmap work Done only with the evidence it asks for.
3. Describe verified behavior as Active and unbuilt direction as Proposed.
4. Append or supersede ADRs; never rewrite accepted history.
5. If nothing is affected, report `Documentation impact: none` with one short reason.

Do not copy issue lists or task status into the Roadmap.

## Reporting

A final report states the outcome and changed files, the owning issue and its Project status, the
checks run and their results, the documentation impact, anything not verified, and blockers or
follow-ups when relevant. If blocked, report the blocker, what you tried, the evidence, and the
smallest decision or access needed next.
