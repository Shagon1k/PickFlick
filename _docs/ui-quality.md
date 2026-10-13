# UI quality checks

Behavioral UI tests build the web app and real Nest backend, then run against PostgreSQL.
The test entry point (`apps/backend/src/testing/ui-api.ts`) creates isolated Club and Session
fixtures and Better Auth test sessions. Movie, email, and storage providers are synthetic;
application mutations, permissions, persistence, and progress polling run through production code.
The test auth instance exempts session reads from rate limiting because all browser test users share
one loopback peer; production authentication limits are unchanged.
Fixture routes are registered only by this loopback test entry point, never by AppModule.

Screenshot tests use `playwright.visual.config.ts` and the read-only display fixtures in
`tests/ui/start-frontend-with-mock-api.mjs`. That server holds no mutable Club or Session state.
Invitation outcome fixtures exist only to capture those display states.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:ui:smoke
pnpm test:ui:contract
pnpm test:ui:visual
```

Set `APP_ENV=test`, `PICKFLICK_ENV_FILE=.env.example`, and `DATABASE_URL` to a disposable
`pickflick_test` PostgreSQL database before behavioral checks. The harness applies migrations and
rejects seed targets outside the repository's local/test safeguards. CI provides PostgreSQL as a
job service. Visual checks need no database.

`pnpm test:ui` runs contract and visual selections sequentially. `test:ui:smoke` selects tagged
behavior checks: persisted Club settings and member removal, Session creation/edit/cancellation,
keyboard Movie selection, targeted Session invitation responses, nomination locking and privacy,
and polling between open tabs, plus the public-page and gallery smoke checks. Contract checks also
cover accessibility, focus return, responsive overflow, reduced motion, and network failure input
retention. Domain edge cases stay in database/API integration tests rather than a second browser-side
implementation.

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
