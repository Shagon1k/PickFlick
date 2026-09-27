# UI quality checks

`pnpm test:ui` builds the web app, starts it on loopback against a mock API
(`tests/ui/start-frontend-with-mock-api.mjs`), and runs the Playwright suite in Chromium over
the public pages, Login, Club onboarding and settings, the recovery states, the `/ui-preview`
component gallery, and the seven `/shell-preview/*` shells.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:ui
```

The suite checks:

- axe accessibility rules at 390 and 1440 pixels;
- keyboard, focus, form constraints, live regions, menus, tabs, score controls, dialogs, and shell
  overlays (the gallery flow lives in `interaction.spec.ts`);
- 44px touch targets and locally scrolling dense regions;
- no horizontal page overflow at every breakpoint and gap width (390, 640, 768, 900, 1024, 1200,
  1440);
- exact screenshot matches at 390 and 1440 pixels (42 baselines);
- collapsed motion when reduced motion is requested.

Viewports are defined once in `tests/ui/viewports.ts`.

## Review a failure

Playwright writes screenshots, diffs, video, traces, and an HTML report under `test-results/`; CI
uploads them when the job fails. Open the report with:

```bash
pnpm exec playwright show-report test-results/ui-report
```

## Update baselines

Change baselines only after the rendered result matches the canonical design:

```bash
pnpm test:ui:update
```

Inspect every changed PNG and rerun `pnpm test:ui` before committing. An updated baseline is not
proof that a visual change is right.

## CI

The `UI accessibility and visual regression` job runs on macOS, where the screenshot baselines were
captured. The system fonts differ on Linux and change text width, page height, and some overflow
results. CI runs `pnpm test:ui` from a clean checkout, retries a failure once, and still fails on
flaky tests. The delivery gate requires it.
