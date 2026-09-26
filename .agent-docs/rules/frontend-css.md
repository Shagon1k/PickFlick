# Frontend CSS Rules

## Layers

1. `apps/frontend/src/styles/tokens.scss` holds CSS custom properties only (Projector Noir tokens). It is
   loaded once through `globals.scss`; never import it anywhere else.
2. `apps/frontend/src/styles/globals.scss` holds the reset, body, focus, and the `.visually-hidden`
   utility.
3. `apps/frontend/src/theme/mantine.ts` maps tokens onto Mantine with `createTheme()`.
4. Every component and route gets its own `*.module.scss`, consuming tokens through `var(--token)`.

## CSS Modules

- One `.module.scss` per component or route. No shared component stylesheets.
- Import it as `import styles from './Name.module.scss'`, always named `styles`.
- A route's styles sit next to it (`page.module.scss`) and its `_components` may use them. A
  stylesheet shared by several routes of one group sits at the group root
  (`(marketing)/marketing.module.scss`). Never import another route's or feature's module.
- `components/shells` is one layout system. Each shell and navigation piece has its own folder,
  but they share `shells.module.scss` and `product-navigation.module.scss`, because their
  selectors cross components (`.productHeader .brand`, `.accountPopover .filmStrip`).
- No inline `style={{ }}` for static values. Inline styles are for runtime values only.
- No `!important` (reduced motion in `globals.scss` is the exception) and no id selectors; lower a
  default's specificity with `:where()` instead. A `stylelint-disable` needs a reason after `--`.
- Media queries use only the design-contract boundaries 576, 768, 1024, and 1400px (or one pixel
  below); Stylelint enforces them.
- Declarations follow the recess group order (position, box model, typography, visuals, motion);
  `pnpm lint:fix` sorts them.
- Use tokens for every colour, shadow, radius, and spacing value. Never hard-code a near-duplicate.
  Stylelint rejects hex colours and `rgb()`/`hsl()` outside `tokens.scss`; the internal galleries
  are exempt from the `rgb()` ban.

## Class names

| Class type       | Pattern                          | Example               |
| ---------------- | -------------------------------- | --------------------- |
| Base             | `.componentName`                 | `.button`             |
| Modifier         | `.m-modifier`, as the prop value | `.m-secondary-danger` |
| Internal element | `.componentName__element-name`   | `.card__action-btn`   |

Apply modifiers with `clsx(styles.button, styles[`m-${variant}`])`.

## Mantine

- Only `apps/frontend/src/components/ui` and `theme/` import `@mantine/*` (lint-enforced). Feature code
  uses the UI components; `@mantine/form` is the one exception.
- UI kit wrappers render Mantine components `unstyled` and style every slot themselves.
- Global defaults go in `createTheme()`. Variants and sizes are compound classes on the base class
  (`.button.m-primary` or nested `&.m-primary`).
- Style internal slots through `classNames={{ root, label, input, error }}`. Never use the
  `styles` prop for static values.
- UI atoms are closed: they don't accept `className`, `classNames`, `style`, or `styles`. Add a
  semantic prop (`variant`, `size`) or wrap the atom in a layout element instead.

## Accessibility

- Keep visible focus, 44px touch targets, semantic control names, and reduced motion.
- Every new component variant needs a keyboard and axe check in its test.
