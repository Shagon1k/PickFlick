# Testing Rules

## Principles

- Tests must be fast, isolated, repeatable, and self-validating. Cover meaningful behaviour (happy
  path, edge cases, error states), not coverage numbers.
- One test file covers one source file.
- Never commit an unconditional `.skip` or `.only`.

## Files

- Unit tests live in a `__tests__` folder next to the file under test and are named
  `<name>.spec.ts` (`<name>.spec.tsx` for components).
- Database integration tests are named `<name>.int.spec.ts` and run with `pnpm test:integration`
  against the local services.
- Browser tests are Playwright `*.spec.ts` files: `tests/ui-preview/` runs against a local
  production build with a mock API (`pnpm ui:test`), `tests/uat/` smokes a deployed environment
  (`pnpm uat:smoke`). Shared viewports live in `tests/ui-preview/viewports.ts`.
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

## Playwright

- Prefer role and label locators. Assert with web-first assertions (`toBeVisible`, `toHaveURL`).
- Screenshot baselines are taken at two widths: mobile 390 and desktop 1440.
- Update baselines only after a reviewed visual change: `pnpm ui:test:update`.
