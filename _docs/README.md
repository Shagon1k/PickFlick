# PickFlick Documentation Map

Start here before non-trivial product, design, architecture, implementation, or operational work.

## Delivery tracking

[GitHub Project 3](https://github.com/users/Shagon1k/projects/3) is the canonical tracker for
actionable active and deferred delivery work. `ROADMAP.md` remains the product/MVP/phase contract and
phase-level acceptance record; do not copy issue status into it.

| Process artifact | Purpose |
| --- | --- |
| [Contributing guide](../CONTRIBUTING.md) | Human-facing issue, branch, commit, PR, and merge workflow. |
| [Git rules](../.agent-docs/rules/git.md) | Canonical branch, commit, PR, and worktree rules. |
| [GitHub issue rules](../.agent-docs/rules/github-issues.md) | Issue routing, Project status semantics, `human-control`, and phase linkage. |

## Canonical guidance

| Artifact | Purpose | State |
| --- | --- | --- |
| [ROADMAP.md](../ROADMAP.md) | Product contract, MVP boundary, business rules, routes, phase sequence/acceptance, and decisions. | Active product/phase contract; not the actionable task inbox. |
| [DESIGN.md](../DESIGN.md) | Design authority, experience structure, screen/state/component coverage, and QA contract. | Approved direction; build/QA not started. |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Accepted deployable, module/data/interface, runtime, security, and operations direction. | Repository and runtime foundations are active; product and deployment implementation remains Proposed or Partial. |
| [Architecture Decision Records](decisions/README.md) | Accepted/rejected/superseded rationale for significant technical choices. | ADR-001 through ADR-008 recorded; ADR-007 supersedes ADR-005 and ADR-008 amends its production-promotion mechanics. |
| [Environment and runtime operations](environment.md) | Runtime variables, local services, image/Compose delivery, migration/release safety, health probes, logging, correlation, shutdown, and API errors. | Active local/runtime and image/topology foundation; provisioned environments extend it later. |
| [UAT provisioning and delivery](uat-operations.md) | GitHub, Dokploy, Cloudflare, exact-revision delivery, smoke, failure-preservation, and rollback procedure. | Repository automation ready; live UAT provisioning and evidence require owner execution. |
| [Production preparation and promotion](production-operations.md) | Dormant production provisioning, guarded SemVer promotion, migration compatibility, activation, failure recovery, and rollback. | Repository workflow and runbook ready; production guard remains false and no cutover is authorized. |
| [UI quality checks](ui-quality.md) | Local and CI accessibility, interaction, viewport, reduced-motion, and visual-regression commands. | Active against the production component preview; exact-SHA owner visual review remains required. |

## Agent entrypoints

| Artifact | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Shared repository operating rules and documentation-impact contract. |
| [CLAUDE.md](../CLAUDE.md) | Thin Claude adapter importing `AGENTS.md`. |

## Design sources

The design package remains flat and self-contained so its relative HTML/image links work. It is authoritative for visual and interaction intent, not production code structure.

| Source | Use |
| --- | --- |
| [Prototype package index](design/prototypes/index.html) | Navigate canonical screens and supporting guides. |
| [Exact design contract](design/prototypes/DESIGN.md) | Tokens, typography, components, navigation, motion, accessibility, and interaction rules. |
| [Design system guide](design/prototypes/design-system.html) | Visual component/state reference and markup examples. |
| [UX flow map](design/prototypes/ux-flow-map.html) | Cross-screen journeys, branches, and handoffs. |
| [Responsive baselines](design/prototypes/responsive-baselines.html) | S/M/L/XL composition contract. |
| [Asset catalog](design/prototypes/asset-catalog.html) | Prototype image consumers, fixture warnings, and duplicate awareness. |
| [Asset manifest](design/prototypes/asset-manifest.json) | Machine-readable prototype asset references. |
| [Brand specification](design/prototypes/brand-spec.md) | Projector Noir and mascot intent. |
| [Responsive critique data](design/prototypes/critique.json) | Supporting review notes for the responsive-reference artifact. |
| [Package handoff](design/prototypes/FINAL-PACKAGE.md) | Package provenance, canonical files, and superseded references. |
| [Production brand asset inventory](../assets/brand/README.md) | Semantic filenames, dimensions, usage guidance, and machine manifest. |

## Source precedence

```text
latest explicit developer decision
  -> ROADMAP / DESIGN / ARCHITECTURE ownership contract
  -> canonical design package for visual and interaction intent
  -> production code/config once implemented and verified
```

The retired blueprint was intentionally removed after synthesis; this repository does not keep it as a competing source of truth.

## Active phase plan

| Plan | Purpose | Lifecycle |
| --- | --- | --- |
| [Phase 1 — Infrastructure, Repository & Deployment Foundation](phase-1-infrastructure-foundation.md) | Cross-issue sequence, inherited contracts, edge cases, commands, and evidence in progress for the Phase 1 slices and deployment follow-ups. | Consolidate durable knowledge and remove this temporary plan/link when Phase 1 completes. |
| [Phase 2 — Production Design System & App Shells](phase-2-production-design-system.md) | Implementation sequence, component boundaries, responsive rules, and evidence in progress for Projector Noir foundations and shells. | Consolidate durable knowledge and remove this temporary plan/link when Phase 2 completes. |
