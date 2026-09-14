# UI quality checks

The Playwright suite checks the production `/ui-preview`, Landing, Pricing, and seven
`/shell-preview/*` routes in Chromium. It builds the internal packages and web app, starts the
standalone web server on loopback, and then runs accessibility, interaction, viewport,
reduced-motion, and screenshot checks.

## Run the suite

Install the pinned dependencies and browser once:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Run the complete UI gate:

```bash
pnpm ui:test
```

The suite verifies:

- default axe rules for the component preview, every shell, Landing, and Pricing at 390px and
  1440px widths;
- keyboard, focus, native constraint, live-region, menu, tab, score, dialog, and mutually exclusive
  shell-overlay behavior, plus Pricing FAQ and unavailable-checkout behavior;
- 44px shell targets and bounded Library/App Admin/Pricing dense regions;
- no horizontal page overflow for the component preview, shells, Landing, and Pricing at 390, 640,
  768, 900, 1024, 1200, and 1440px widths;
- exact matching against four component, 28 shell, and eight public-page full-page baselines at
  390, 768, 1024, and 1440px widths; and
- immediate menu and FAQ behavior when the browser requests reduced motion.

Run the component-preview viewport and screenshot checks with `pnpm ui:visual`. Shell and public
page captures run as part of `pnpm ui:test`. To exercise the interaction smoke against an
already-running production web build, run:

```bash
pnpm ui:smoke -- http://127.0.0.1:<port>
```

## Review a failure

Playwright writes failure screenshots, visual diffs, video, traces, axe JSON, and an HTML report
under `test-results/`. The interaction smoke enforces its timeout inside the child process so it can
flush its screenshot, trace, and video before failing. CI uploads `test-results/` when the UI job
fails. Open a trace with the exact command printed by Playwright, or open the report locally with:

```bash
pnpm exec playwright show-report test-results/ui-report
```

The accessibility assertion lists each rule, impact, selector, and failure summary. The controlled
defect test proves that an unnamed button produces this diagnostic without leaving an invalid
component in the preview.

## Update visual baselines

Update screenshots only after confirming that the rendered change matches the canonical design
sources:

```bash
pnpm ui:test:update
```

Inspect every changed PNG and rerun `pnpm ui:test` before committing. Do not use an updated baseline
as proof that a visual change is correct. The exact-SHA preview and owner acknowledgement remain the
required visual-review checkpoint for issues labeled `preview-required`.

## CI behavior

The `UI accessibility and visual regression` job installs Chromium and runs `pnpm ui:test` from a
clean checkout. CI retries a failed check once, but detected flaky tests still fail the job. The
terminal delivery gate requires this job. CI retains failure evidence for 14 days; a passing run
does not upload routine artifacts.
