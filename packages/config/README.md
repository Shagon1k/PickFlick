# @pickflick/config

Shared configuration for every workspace.

- `@pickflick/config/environment` — one zod schema for the runtime environment
  (`parseRuntimeEnvironment`, `loadRuntimeEnvironment`) plus a smaller one for database commands.
  Cross-variable rules (email mode per environment, HTTPS in deployed environments, Apple
  credentials) live in a rule table next to the schema. Failures name variables, never values.
- ESLint lives in the separate dev-only `@pickflick/eslint-config` package, including house-style rules.
- `@pickflick/config/tsconfig/*.json` — TypeScript presets for libraries, Node apps, and Next.js.

Add a variable to `.env.example`, `environment.schema.ts`, and `_docs/environment.md` in the same
change.
