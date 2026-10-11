# UI quality checks

The UI scripts build the web app, start it on loopback against a mock API
(`tests/ui/start-frontend-with-mock-api.mjs`), and run Playwright in Chromium over
the public pages, Login, Club onboarding, Hub overview, settings, Club invitation states, the recovery
states, Hub membership restrictions and pending invitations, the `/ui-preview` component gallery,
live Session creation/edit/cancellation, and the seven `/shell-preview/*` shells.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:ui:smoke
pnpm test:ui:contract
pnpm test:ui:visual
```

`pnpm test:ui` runs the full suite. Playwright's `@smoke` tag selects PR checks with
`test:ui:smoke`: security headers and CSP, Club switching and stale access, invitation sign-in
continuation and responses, member removal, landing accessibility, a pricing interaction, product shell navigation, global Movie search and read-only Movie Details at 390, 768, 1024 and 1440px, and overflow
at 1024px, plus full-cycle creation/edit/cancellation and keyboard pre-selected Movie creation. Screenshot comparisons use the `@visual` tag;
`test:ui:contract` excludes it, and `test:ui:visual` selects it. The contract selection includes
accessibility, keyboard and touch interaction, security headers and CSP, responsive overflow,
reduced motion, and other behavior assertions.

The suite checks:

- axe accessibility rules at 390 and 1440 pixels;
- keyboard, focus, form constraints, live regions, menus, tabs, score controls, dialogs, and shell
  overlays (the gallery flow lives in `interaction.spec.ts`);
- 44px touch targets and locally scrolling dense regions;
- no horizontal page overflow at every breakpoint and gap width (390, 640, 768, 900, 1024, 1200,
  1440);
- exact screenshot matches at 390 and 1440 pixels (76 baselines, visual selection);
- collapsed motion when reduced motion is requested.

Viewports are defined once in `tests/ui/viewports.ts`.

## Review a failure

Playwright writes screenshots, diffs, video, traces, and an HTML report under `test-results/`; CI
uploads them when the job fails. Open the report with:

```bash
pnpm exec playwright show-report test-results/ui-report
```

## Update baselines

Change baselines only after the rendered result matches the canonical design. Run this in the
digest-pinned Linux Playwright image used by CI, with Node 24.15.0 from `.node-version`:

```bash
pnpm test:ui:update
```

Inspect every changed PNG and rerun `pnpm test:ui:visual` in that image before committing. An
updated baseline is not proof that a visual change is right.

## CI

The `UI smoke` job runs on ordinary PR updates. The full `UI contract` and `UI visual regression`
jobs run on `main` pushes and manual CI runs; both are skipped on ordinary PR updates. All run on
Linux in `mcr.microsoft.com/playwright:v1.63.0-noble`, pinned by digest in `ci.yml`, so fonts and
browser dependencies do not drift with the GitHub runner. CI uses the locked Node and pnpm versions,
retries a failure once, and fails on flaky tests.

To compare a branch's screenshots before merging, open **Actions → CI → Run workflow**, select the
branch, and run it. The manual run requires both full UI jobs. On `main`, contract and visual
regression must pass the Delivery gate before `deploy-uat.yml` can start its automatic deployment.
PRs require the smoke job; the Delivery gate accepts skipped full UI jobs only on PRs.
