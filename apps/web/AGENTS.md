<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Web module boundaries

- Keep route `page.tsx` files focused on Next.js metadata, request-input resolution, and component
  composition. Move error catalogs, reusable parsing, provider/API calls, and stateful interaction
  logic into named files under the owning component or feature directory.
- Route browser-to-backend calls through an owning `*.service.ts` or `*.api.ts` facade. Components
  consume that facade instead of importing a generated or third-party client directly.
- Extend shared UI primitives, including `Icon`, before adding page-local copies of an existing
  visual pattern.
