# Testing Rules

## Principles

- Tests must be fast, isolated, repeatable, and self-validating. Cover meaningful behaviour (happy
  path, edge cases, error states), not coverage numbers.
- Prove each behaviour at the lowest layer that can: unit before integration before Playwright.
  Do not repeat the same case in several layers; a higher layer checks only what the lower one
  cannot, such as wiring, rendering, or the real database.
- One test file covers one source file.
- Never commit an unconditional `.skip` or `.only`.

## Files

- Unit tests live in a `__tests__` folder next to the file under test and are named
  `<name>.spec.ts` (`<name>.spec.tsx` for components).
- Database integration tests are named `<name>.int.spec.ts` and run with `pnpm test:integration`
  against the local services.
- Browser tests are Playwright `*.spec.ts` files: `tests/ui/` runs against a local
  production build with a mock API (`pnpm test:ui`), `tests/uat/` smokes a deployed environment
  (`pnpm test:uat`). Shared viewports live in `tests/ui/viewports.ts`.
- `tests/journeys/` runs a few core flows through the built web app and the real API against
  `pickflick_test` (`PICKFLICK_ENV_FILE=.env.test pnpm test:journeys`). Users sign in through Better
  Auth's test plugin in the test process, and catalog searches are seeded, so no provider or
  test-only endpoint is involved. Keep scripted failures and edge states on the UI mock.
- The UI mock API is TypeScript that Node runs directly. Annotate every response with its
  `@pickflick/contracts` type so `pnpm typecheck` fails when the mock drifts from the real API.
- Build test data with small factory functions instead of repeating inline objects.

## Naming and structure

- The top-level `describe` names the unit under test. Nested blocks start with `when ...`.
- `it` blocks start with `should ...`.
- Arrange, act, assert inside each test.

## Vitest

- Vitest globals are enabled: don't import `describe`, `it`, `expect`, `vi`, or hooks.
- Mock what you own. Wrap a third-party client (Resend, S3, Better Auth) behind a module or
  injection token and mock that.
- Type mocks with `vi.fn<(input: IInput) => Promise<IResult>>()` instead of unused parameters.
- `@vitest/eslint-plugin` enforces focused-test bans, valid titles, and at least one assertion per
  test; a helper named `expect*` (such as `expectConstraint`) counts as one.

## Playwright

- Prefer role and label locators. Assert with web-first assertions (`toBeVisible`, `toHaveURL`).
- After `page.goto(…, { waitUntil: 'load' })`, call `settle(page)` from `settle.ts` before measuring
  layout, contrast, or pixels: it waits for fonts, images, and finite animations. Never wait for
  `networkidle`; link prefetching keeps the network busy.
- `eslint-plugin-playwright` enforces awaited actions and assertions, no focused or conditional
  tests, and web-first assertions.
- Screenshot baselines are taken at two widths: mobile 390 and desktop 1440.
- Add reviewed baselines for every new screen or implemented prototype state in the same PR.
  Cover its key populated, empty, read-only/hidden, and dialog states where applicable. Compare
  each capture with the canonical prototype and record the review in the PR; passing pixels alone
  do not establish design fidelity.
- Tag every screenshot comparison with Playwright's `{ tag: '@visual' }`. Tag the explicit PR
  behavior selection with `{ tag: '@smoke' }`; the full contract selection includes these checks.
  Run both `pnpm test:ui:smoke` and `pnpm test:ui:visual` on every PR. Main pushes and manual CI
  runs require both `pnpm test:ui:contract` and `pnpm test:ui:visual`. The Delivery gate requires
  every selected suite; missing or mismatched baselines fail the PR.
- Update baselines in the pinned Linux Playwright image only after a reviewed visual change:
  `pnpm test:ui:update`. See [UI quality checks](../../_docs/ui-quality.md).
