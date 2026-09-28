# Phase 6 — Human Verification & Bug Fixing I

Temporary phase document for [#32](https://github.com/Shagon1k/PickFlick/issues/32). It records what
was verified, every finding, and every deferral. Delete it and its docs-map link when Phase 6 closes,
after moving anything durable into canonical guidance.

## Tested build

- Branch `PF-32_verify-phases-1-5`, local macOS workstation, Node 24.15.0, pnpm 11.25.0, Chromium
  from Playwright 1.63.
- Local PostgreSQL and MinIO from `compose.local.yaml`; email delivery disabled.
- Phase implementation gates run before the CI policy change: `pnpm audit --audit-level high`,
  `pnpm verify` (ESLint, Stylelint, knip, formatting, types, unit tests, build),
  `pnpm test:integration`, `pnpm test:e2e`,
  `pnpm build:images`, and `pnpm test:ui` (138 checks, 42 screenshot baselines at 390 and 1440
  pixels).
- CI policy verification in the digest-pinned Linux Playwright image: 96 UI contract checks pass;
  all 42 screenshot baselines were reviewed and regenerated for Linux, then 42 visual checks pass
  without update mode. Changed files pass Prettier and ESLint, workspace typecheck passes, and
  `actionlint` accepts `ci.yml` and `deploy-uat.yml`. Remote Actions verification is pending; the
  previous Delivery gate did not start because of GitHub's account payment or spending-limit block.
- Follow-up PR policy verification in the same Linux image with Node 24.15.0: the tagged smoke
  selection passes 6 checks in 1.7 minutes (143 seconds for the local command, including setup and
  build). The full contract and visual selections still list 96 and 42 checks. `actionlint` accepts
  `ci.yml`; the Delivery gate accepts PR, `main`, and manual success results and rejects missing or
  unexpected UI job results.
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

### Quality gates and hardening

| #   | Finding                                                                                                       | Severity | Outcome                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| H1  | Responses sent no CSP, HSTS, or framing protection.                                                           | Major    | Fixed; nonce CSP and security headers, ADR-015, [Security](security.md)   |
| H2  | The Prisma CLI pulled `mysql2` and `deepmerge-ts` versions with high-severity advisories.                     | Minor    | Fixed with `overrides`; CI now fails on high advisories; Dependabot added |
| H3  | The release image copied the Prisma engine from a path naming version 7.10.0.                                 | Major    | Fixed; the version is resolved at build time                              |
| H4  | Production CSS used breakpoints outside the design contract (480, 820, 920, 960px).                           | Minor    | Fixed; contract breakpoints only, lint-enforced; public links from 768px  |
| H5  | Documented house rules (default exports, CSS tokens, class names, folder names) were not enforced.            | Minor    | Fixed; ESLint, Stylelint, and knip rules; violations corrected            |
| H6  | Internal links were plain `<a>`, so every navigation reloaded the whole page.                                 | Minor    | Fixed; `next/link` throughout, Next.js lint rules                         |
| H7  | Create Club's invalid-submit handler read the global `window.event`, so focus never moved to the first error. | Minor    | Fixed; found by type-aware lint                                           |
| H8  | Playwright specs, script tests, and configs were outside every tsconfig, so `tsc` never checked them.         | Minor    | Fixed; root `tsconfig.json`, 22 type errors corrected                     |
| H9  | A root-layout failure fell back to Next.js's unbranded error page.                                            | Trivial  | Fixed; `app/global-error.tsx`                                             |

## Deferrals

| Item                                                                                             | Severity | Owner / revisit trigger                                     |
| ------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| UAT evidence: exact-revision delivery, failed-release gate, rollback, guard test.                | Major    | Alex; before Phase 6 closes (owner-run, needs live UAT)     |
| Live Google sign-in and Contact email in UAT, with no CSP violations in the browser console.     | Major    | Alex; before Phase 6 closes                                 |
| Turn on Dependabot security updates in the repository settings.                                  | Minor    | Alex; GitHub Settings → Code security                       |
| Point the Dokploy UAT domain route at `frontend:3000` (the service was `web` before the rename). | Major    | Alex; before the next UAT deployment                        |
| Apple Sign In activation.                                                                        | —        | Product owner; Decision Log "Apple Sign In activation"      |
| Explicit provider linking.                                                                       | —        | Decision Log "Explicit provider linking"                    |
| Database still accepts a stored `1..N` scale start.                                              | Trivial  | Separate reviewed migration if the schema is tightened      |
| Sweep of abandoned avatar objects.                                                               | Minor    | Before production retention is considered complete          |
| `components/shells` keeps two shared stylesheets instead of one per component.                   | Trivial  | Accepted: selectors cross components; see `frontend-css.md` |
| `/ui-preview` gallery textarea no longer stretches inside equal-height panels.                   | Trivial  | Accepted; internal page only                                |
| Contact form lost no-JavaScript submission when it moved to `@mantine/form`.                     | Minor    | Revisit if progressive enhancement becomes a requirement    |

## Closing the phase

Phase 6 closes when the owner-run deferrals marked Major have evidence, CI passes on the merged
branch, and this register shows no open Blocker or Major. Then record the evidence in `ROADMAP.md`
and delete this file.
