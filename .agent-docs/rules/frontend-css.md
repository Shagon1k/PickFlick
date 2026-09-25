# Frontend CSS Rules

## Layers

1. `apps/web/src/styles/tokens.scss` holds CSS custom properties only (Projector Noir tokens). It is
   loaded once through `globals.scss`; never import it anywhere else.
2. `apps/web/src/styles/_typography.scss` holds text-style mixins. Use them with
   `@use 'styles/typography' as *`.
3. `apps/web/src/theme/mantine.ts` maps tokens onto Mantine with `createTheme()`.
4. Every component and route gets its own `*.module.scss`, consuming tokens through `var(--token)`.

## CSS Modules

- One `.module.scss` per component or route. No shared component stylesheets.
- Import it as `import styles from './Name.module.scss'`, always named `styles`.
- A route's styles sit next to it (`page.module.scss`); never import another route's or feature's
  module to style your own elements.
- No inline `style={{ }}` for static values. Inline styles are for runtime values only.
- Use tokens for every colour, shadow, radius, and spacing value. Never hard-code a near-duplicate.

## Class names

| Class type       | Pattern                        | Example             |
| ---------------- | ------------------------------ | ------------------- |
| Base             | `.componentName`               | `.button`           |
| Modifier         | `.m-modifierName`              | `.m-primary`        |
| Internal element | `.componentName__element-name` | `.card__action-btn` |

Apply modifiers with `clsx(styles.button, styles[`m-${variant}`])`.

## Mantine

- Only `apps/web/src/components/ui` imports `@mantine/*`. Feature code uses the UI components.
- Global defaults go in `createTheme()`. Variants and sizes are compound classes nested in the
  base class (`.button { &.m-primary { ... } }`), which beat Mantine's single-class selectors.
- Style internal slots through `classNames={{ root, label, input, error }}`. Never use the
  `styles` prop for static values.
- UI atoms are closed: they don't accept `className`, `classNames`, `style`, or `styles`. Add a
  semantic prop (`variant`, `size`) or wrap the atom in a layout element instead.

## Accessibility

- Keep visible focus, 44px touch targets, semantic control names, and reduced motion.
- Every new component variant needs a keyboard and axe check in its test.
