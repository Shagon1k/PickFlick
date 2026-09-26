# Phase 6 — Human Verification & Bug Fixing I

Temporary phase document for [#32](https://github.com/Shagon1k/PickFlick/issues/32). It records what
was verified, every finding, and every deferral. Delete it and its docs-map link when Phase 6 closes,
after moving anything durable into canonical guidance.

## Tested build

- Branch `PF-32_verify-phases-1-5`, local macOS workstation, Node 24.15.0, pnpm 11.25.0, Chromium
  from Playwright 1.63.
- Local PostgreSQL and MinIO from `compose.local.yaml`; email delivery disabled.
- Gates run after the final change: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:integration`, `pnpm build`, `pnpm e2e:smoke`, `pnpm compose:check`, and `pnpm ui:test`
  (136 checks, 42 screenshot baselines at 390 and 1440 pixels).
- Not yet exercised: UAT at `https://uat.pick-flick.app`, live Google sign-in, and live email.

## Register

Severity: **Blocker** stops the phase; **Major** breaks a flow or hides a failure; **Minor** is a
visible defect with a workaround; **Trivial** is cosmetic.

### Design review (owner walkthrough)

| #   | Finding                                                                                    | Severity | Outcome                                                         |
| --- | ------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------- |
| D1  | Header navigation hover and current state did not match the prototypes.                    | Minor    | Fixed                                                           |
| D2  | Public header listed Contact instead of Features.                                          | Minor    | Fixed; Decision Log "Public marketing navigation"               |
| D3  | Header CTA had the wrong label, style, and target, and stretched on mobile.                | Minor    | Fixed ("Go to App")                                             |
| D4  | Mobile public pages showed a bottom menu with a single item.                               | Minor    | Fixed; menu removed                                             |
| D5  | Landing quote weight and footer composition differed from the design.                      | Trivial  | Fixed                                                           |
| D6  | Screenshot baselines drifted after the Node/Next toolchain upgrade.                        | Major    | Fixed; drift confirmed as rendering change, baselines refreshed |
| D7  | Club tabs and sidebar links rendered brighter than intended.                               | Minor    | Fixed; navigation brightness unified                            |
| D8  | 404 content hid behind the mascot on mobile.                                               | Minor    | Fixed                                                           |
| D9  | Selection score and Danger Zone lacked explanations; Manage Club cards had uneven heights. | Minor    | Fixed; InfoTip added                                            |
| D10 | Create Club offered a `1..N` scale the design does not show.                               | Minor    | Fixed; Decision Log "Selection scale start"                     |

### Code review

| #      | Finding                                                                                                                           | Severity | Outcome                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| C1     | The `get-session` limiter only reset after a full minute of silence.                                                              | Major    | Fixed; later replaced by Better Auth and `@nestjs/throttler` limits    |
| C2     | Any session-check failure was treated as signed out, hiding API outages.                                                          | Major    | Fixed; pages distinguish signed out from unavailable                   |
| C3     | A rejected avatar left an orphaned object in storage.                                                                             | Minor    | Fixed; failed writes clean up, abandoned-object sweep deferred (below) |
| C4     | Every `409` showed the same misleading message.                                                                                   | Major    | Fixed; conflicts carry a `reason` with its own copy                    |
| L1–L11 | Duplicated helpers, dead code, raw style values, preview routes reachable in production, split shell files, and similar cleanups. | Minor    | Fixed                                                                  |

### Restructure to the TailorTales conventions

Owner-approved simplification, recorded in ADR-012–ADR-014 and the Decision Log: zod contracts and
environment, NestJS feature modules with nestjs-pino and the throttler, the UI kit moved into the web
frontend on unstyled Mantine, `@mantine/form` forms, deployment logic in workflow steps, the worker, Redis,
observability package, Contact storage, and operation IDs removed, `apps/web` and `apps/api` renamed to
`apps/frontend` and `apps/backend`, and lint-enforced house style.

Findings made while restructuring:

| #   | Finding                                                                                           | Severity | Outcome                                                                            |
| --- | ------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| R1  | The web API client failed on bodiless `202` answers, so Contact reported a false failure.         | Major    | Fixed                                                                              |
| R2  | Field live regions sat inside the described element, so screen readers read errors twice.         | Minor    | Fixed                                                                              |
| R3  | The UAT readiness check expected a health field the rewritten API no longer returns.              | Major    | Fixed; readiness now checks the deployed revision in `deploy-uat.yml`              |
| R4  | CI's placeholder Apple key would crash the API, which now signs Apple's client secret at startup. | Major    | Fixed; any enabled Apple key is validated, and the smoke generates a throwaway key |

## Deferrals

| Item                                                                                             | Severity | Owner / revisit trigger                                           |
| ------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| UAT evidence: exact-revision delivery, failed-release gate, rollback, guard test.                | Major    | Alex; before Phase 6 closes (owner-run, needs live UAT)           |
| Live Google sign-in and Contact email in UAT.                                                    | Major    | Alex; before Phase 6 closes                                       |
| Point the Dokploy UAT domain route at `frontend:3000` (the service was `web` before the rename). | Major    | Alex; before the next UAT deployment                              |
| Apple Sign In activation.                                                                        | —        | Product owner; Decision Log "Apple Sign In activation"            |
| Explicit provider linking.                                                                       | —        | Decision Log "Explicit provider linking"                          |
| Database still accepts a stored `1..N` scale start.                                              | Trivial  | Separate reviewed migration if the schema is tightened            |
| Sweep of abandoned avatar objects.                                                               | Minor    | Before production retention is considered complete                |
| `components/shells` keeps two shared stylesheets instead of one per component.                   | Trivial  | When a shell is reworked; see `.agent-docs/rules/frontend-css.md` |
| `/ui-preview` gallery textarea no longer stretches inside equal-height panels.                   | Trivial  | Accepted; internal page only                                      |
| Contact form lost no-JavaScript submission when it moved to `@mantine/form`.                     | Minor    | Revisit if progressive enhancement becomes a requirement          |

## Closing the phase

Phase 6 closes when the owner-run deferrals marked Major have evidence, CI passes on the merged
branch, and this register shows no open Blocker or Major. Then record the evidence in `ROADMAP.md`
and delete this file.
