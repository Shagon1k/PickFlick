# PickFlick Documentation Map

Start here before non-trivial product, design, architecture, implementation, or operational work.

## Delivery tracking

[GitHub Project 3](https://github.com/users/Shagon1k/projects/3) is the canonical tracker for
actionable active and deferred delivery work. `ROADMAP.md` remains the product/MVP/phase contract and
phase-level acceptance record; do not copy issue status into it.

| Process artifact                                            | Purpose                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Contributing guide](../CONTRIBUTING.md)                    | Human-facing issue, branch, commit, PR, and merge workflow.                  |
| [Git rules](../.agent-docs/rules/git.md)                    | Canonical branch, commit, PR, and worktree rules.                            |
| [GitHub issue rules](../.agent-docs/rules/github-issues.md) | Issue routing, Project status semantics, `human-control`, and phase linkage. |

## Canonical guidance

| Artifact                                                         | Purpose                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [ROADMAP.md](../ROADMAP.md)                                      | Product contract, business rules, routes, phases, and the Decision Log.                                                            |
| [DESIGN.md](../DESIGN.md)                                        | Design authority, screens and states, components, responsive and accessibility QA.                                                 |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                            | Deployables, modules, data, interfaces, runtime, and delivery.                                                                     |
| [Architecture Decision Records](decisions/README.md)             | Rationale for significant technical choices (ADR-001–ADR-014).                                                                     |
| [Environment and runtime operations](environment.md)             | Variables, local services, CI, images and Compose, health, errors, logs.                                                           |
| [UAT provisioning and delivery](uat-operations.md)               | Owner-run UAT setup and the automatic exact-revision delivery.                                                                     |
| [Production preparation and promotion](production-operations.md) | Dormant production setup, guarded promotion, migrations, rollback.                                                                 |
| [UI quality checks](ui-quality.md)                               | Playwright accessibility, interaction, viewport, and screenshot checks.                                                            |
| [Code style rules](../.agent-docs/rules/typescript.md)           | TypeScript, [CSS](../.agent-docs/rules/frontend-css.md), and [test](../.agent-docs/rules/testing.md) conventions enforced by lint. |

## Agent entrypoints

| Artifact                  | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| [AGENTS.md](../AGENTS.md) | Shared repository operating rules and documentation-impact contract. |
| [CLAUDE.md](../CLAUDE.md) | Thin Claude adapter importing `AGENTS.md`.                           |

## Design sources

The design package remains flat and self-contained so its relative HTML/image links work. It is authoritative for visual and interaction intent, not production code structure.

| Source                                                              | Use                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Prototype package index](design/prototypes/index.html)             | Navigate canonical screens and supporting guides.                                         |
| [Exact design contract](design/prototypes/DESIGN.md)                | Tokens, typography, components, navigation, motion, accessibility, and interaction rules. |
| [Design system guide](design/prototypes/design-system.html)         | Visual component/state reference and markup examples.                                     |
| [UX flow map](design/prototypes/ux-flow-map.html)                   | Cross-screen journeys, branches, and handoffs.                                            |
| [Responsive baselines](design/prototypes/responsive-baselines.html) | S/M/L/XL composition contract.                                                            |
| [Asset catalog](design/prototypes/asset-catalog.html)               | Prototype image consumers, fixture warnings, and duplicate awareness.                     |
| [Asset manifest](design/prototypes/asset-manifest.json)             | Machine-readable prototype asset references.                                              |
| [Brand specification](design/prototypes/brand-spec.md)              | Projector Noir and mascot intent.                                                         |
| [Responsive critique data](design/prototypes/critique.json)         | Supporting review notes for the responsive-reference artifact.                            |
| [Package handoff](design/prototypes/FINAL-PACKAGE.md)               | Package provenance, canonical files, and superseded references.                           |
| [Production brand asset inventory](../assets/brand/README.md)       | Semantic filenames, dimensions, usage guidance, and machine manifest.                     |

## Source precedence

```text
latest explicit developer decision
  -> ROADMAP / DESIGN / ARCHITECTURE ownership contract
  -> canonical design package for visual and interaction intent
  -> production code/config once implemented and verified
```

The retired blueprint was intentionally removed after synthesis; this repository does not keep it as a competing source of truth.

## Active phase plan

| Plan                                                                           | Purpose                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [Phase 6 — Human Verification & Bug Fixing I](phase-6-human-verification-1.md) | Tested build, severity-classified register, and deferrals for Phases 1–5. |
