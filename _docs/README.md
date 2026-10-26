# Documentation map

Start here before non-trivial product, design, architecture, implementation, or operations work.

## Canonical documents

| Document                                          | Owns                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [ROADMAP.md](../ROADMAP.md)                       | Scope, business rules, routes, phases and their evidence, and the Decision Log.      |
| [DESIGN.md](../DESIGN.md)                         | Experience direction, screens and states, components, and design QA.                 |
| [ARCHITECTURE.md](../ARCHITECTURE.md)             | Deployables, modules, data, interfaces, runtime, and delivery.                       |
| [ADR registry](decisions/README.md)               | Rationale for significant technical choices (ADR-001–ADR-018).                       |
| [Develop locally](local-development.md)           | How-to: run the app, work with the database, run the checks, fix common problems.    |
| [Add a feature end to end](adding-a-feature.md)   | How-to: schema, backend module, frontend call, form, and tests, using Contact.       |
| [Authentication and sessions](authentication.md)  | Explanation: sign-in, sessions, the auth guard, and abuse limits.                    |
| [Security](security.md)                           | Explanation: headers and CSP, cross-site requests, input, secrets, and dependencies. |
| [Environment reference](environment.md)           | Variables, email identities, health, errors, logs, CI, images, and Compose.          |
| [UAT operations](uat-operations.md)               | Provisioning UAT and how automatic delivery works.                                   |
| [Production operations](production-operations.md) | Keeping production inactive, provisioning, promotion, rollback, and recovery.        |
| [UI quality checks](ui-quality.md)                | Running and reviewing the Playwright suite.                                          |

## Working rules

| Document                                                                                                                                     | Purpose                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [AGENTS.md](../AGENTS.md) ([CLAUDE.md](../CLAUDE.md) imports it)                                                                             | Operating rules for agents and the documentation contract.        |
| [Code style](../.agent-docs/rules/typescript.md), [CSS](../.agent-docs/rules/frontend-css.md), [tests](../.agent-docs/rules/testing.md)      | Conventions, most of them enforced by `pnpm lint`.                |
| [CONTRIBUTING.md](../CONTRIBUTING.md), [Git rules](../.agent-docs/rules/git.md), [GitHub issue rules](../.agent-docs/rules/github-issues.md) | Issues, branches, commits, pull requests, and Project 3 statuses. |

[GitHub Project 3](https://github.com/users/Shagon1k/projects/3) tracks actionable work and its
status; the Roadmap does not repeat it.

## Design sources

The package stays flat and self-contained so its relative links work. It is authoritative for visual
and interaction intent, not for code structure.

| Source                                                                                                   | Use                                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Prototype index](design/prototypes/index.html)                                                          | Every canonical screen and guide.                                  |
| [Design contract](design/prototypes/DESIGN.md)                                                           | Tokens, typography, components, navigation, motion, accessibility. |
| [Design system](design/prototypes/design-system.html)                                                    | Component and state reference with markup examples.                |
| [UX flow map](design/prototypes/ux-flow-map.html)                                                        | Journeys, branches, and handoffs.                                  |
| [Responsive baselines](design/prototypes/responsive-baselines.html)                                      | S/M/L/XL composition.                                              |
| [Asset catalog](design/prototypes/asset-catalog.html), [manifest](design/prototypes/asset-manifest.json) | Prototype image use and fixture warnings.                          |
| [Brand specification](design/prototypes/brand-spec.md)                                                   | Projector Noir and mascot intent.                                  |
| [Responsive critique](design/prototypes/critique.json)                                                   | Review notes behind the responsive reference.                      |
| [Package handoff](design/prototypes/FINAL-PACKAGE.md)                                                    | Provenance, canonical files, and superseded references.            |
| [Production brand assets](../assets/brand/README.md)                                                     | Semantic filenames, dimensions, and usage.                         |

## Source precedence

```text
latest explicit developer decision
  -> ROADMAP / DESIGN / ARCHITECTURE, each for what it owns
  -> the design package for visual and interaction intent
  -> production code and configuration once implemented and verified
```

The retired blueprint was removed after synthesis and is not a source of truth.

## Current verification

[Phase 16 — Statistics and achievements](phase-16-statistics-achievements.md) is active for Club
statistics and the rating leaderboard under #57, personal Library statistics under #58, and
versioned achievements under #59.

[Phase 15 — Personal Library, Ratings and Watchlist](phase-15-personal-library.md) is active.
The active deliveries cover editable Personal Ratings, synchronization from live Session Ratings,
and prioritized Watchlist controls across Movie Details and the Library.

[Phase 14 — Past Sessions](phase-14-past-sessions.md) is active for historical screenings and optional
nomination/score reconstruction.

Phase 12 closed under [#48](https://github.com/Shagon1k/PickFlick/issues/48).
[Phase 13 — Watching, Rating and completion](phase-13-watching-rating-completion.md) is active. [Roadmap phase evidence](../ROADMAP.md#11-progress) and
[Design QA](../DESIGN.md#8-design-qa) hold the recorded checks and carried-forward limits. The temporary Phase 6–11 documents
were consolidated into the canonical references above and removed. Phase 12 verification used its
existing branch and issue without a separate findings register.
