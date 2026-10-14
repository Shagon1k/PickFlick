<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend

Next.js App Router + Mantine. Routes live in route groups; a component sits next to the route that
uses it (`_components/`) and moves to `src/components/` only when a second route needs it.

## Rule index

- TypeScript and React: `../../.agent-docs/rules/typescript.md`
- CSS Modules and Mantine: `../../.agent-docs/rules/frontend-css.md`
- Tests: `../../.agent-docs/rules/testing.md`

## Structure

- `src/app/(marketing)`, `(auth)`, `(product)` hold the real routes; `(internal)` holds the
  component gallery, which production answers with 404.
- A route folder owns its `page.tsx`, `page.module.scss`, `actions.ts`, and `_components/`.
- `src/components/ui/<Name>/` is the UI kit (Mantine wrappers). Shared app pieces live in
  `src/components/<group>/<Name>/<Name>.tsx`, such as `shells/PublicShell`; lint enforces the
  folder names, and a new group joins the rule's `ignoreWords`.
- Pages wrap themselves in `shells/PublicShell` (marketing) or `shells/ProductFrame` (signed in).
  `AdminShell`, `ControlShell`, `ProductShell`, `SessionShell`, and `SetupShell` are layouts for
  later phases; only the `/shell-preview` gallery renders them.
- `src/api/<area>.server.ts` calls the backend from the server and starts with
  `import 'server-only'`. Components and actions use these functions, never `fetch` directly.
- Build API paths with `apiPath` so each ID stays one segment. A server action maps a failed
  request to copy with `getFailureMessage` (`@/lib/action-failure`); a component checks
  `getOfflineMessage` (`@/lib/offline`) before sending and shows its copy when offline.
- Import with the `@/` alias; images from `assets/brand` with `@brand/`.
- Navigate inside the app with `next/link` (or `ButtonLink`, which wraps it). A plain `<a>` is for
  `mailto:`, in-page `#` anchors, and `BackLink`, whose history check needs a real page load.
- `app/error.tsx` handles failures inside pages; `app/global-error.tsx` replaces the root layout
  when the layout itself fails, so it uses no Mantine or shell.
- Copy `src/app/(auth)/login` as the template for a new route and
  `src/app/(marketing)/contact/_components/ContactForm` for a form.
