# TypeScript Rules

Write the obvious version. If a reader needs a comment to follow the control flow, simplify the
code instead.

`pnpm lint` enforces the `I`/`T` prefixes, the ban on `Readonly<>`, sorted imports, `*.spec.ts`
test names, default-exported components, component folder names, and the frontend import
boundaries below. The pre-commit hook runs it on staged files.

## General

- The project runs with `strict` and `noUncheckedIndexedAccess`. Rely on the compiler; don't add
  redundant runtime guards for values TypeScript already proves.
- Never use `any`. Use `unknown` for truly unknown input and narrow it (usually with a zod schema).
- Avoid `as` assertions. Allowed only at a library boundary whose types are wrong, with a one-line
  reason comment.
- Prefer string literal unions over enums.
- Use `interface` for object shapes, `type` for unions, intersections, and utility compositions.
- Prefix interfaces with `I` (`IClubSummary`), type aliases with `T` (`TClubRole`), and generic
  parameters with `T` plus a name (`<TResponse>`).
- Import types with the `type` keyword.
- Do not wrap props or parameters in `Readonly<...>` and do not mark every field `readonly`. Keep
  `readonly`/`as const` for shared constant tables and exported contract arrays only.
- Optional fields are `field?: T`. Do not write `field?: T | undefined` and do not build objects
  with `...(value ? { value } : {})` just to skip undefined; pass the value.
- Extract types into a `*.types.ts` file only when two or more files use them. Never for props.
- Don't create a separate type for a function with two or fewer parameters; inline it.
- Use utility types (`Pick`, `Omit`, `Partial`) instead of redefining shapes.
- Never use `@ts-ignore`. Use `@ts-expect-error` with a reason.
- Never swallow errors. Catch as `unknown`, log or translate, and rethrow or return a visible state.

## Naming

- Short, plain names that say what the thing is: `ActionState`, not `ClubManagementActionState`
  inside the clubs folder; `NOINDEX_ROUTES`, not `NON_PUBLIC_INDEXING_BOUNDARIES`.
- One term per concept. Canonical domain names are `Club`, `Session`, `Selection`,
  `SessionRating`, and `PersonalMovieRating`.
- Files are kebab-case (`club-settings.service.ts`). React component folders and files are
  PascalCase (`Button/Button.tsx`).

## Validation

- Request, form, and environment shapes are zod schemas. Shared request/response schemas live in
  `@pickflick/contracts`; infer types with `z.infer` instead of writing them twice.
- Name schemas `<thing>Schema` (`createClubSchema`) and inferred types `T<Thing>`
  (`TCreateClubRequest`).

## Comments

- Comment the why, not the what. Explain a non-obvious decision or workaround; delete narration
  that repeats the code.
- Delete commented-out code.

## Scope

- No speculative code. Don't add a capability, option, or abstraction without a current caller.
  It returns with the phase that needs it.
- Prefer a well-known library (zod, AWS SDK, @nestjs/throttler, nestjs-pino, Mantine,
  @mantine/form) over hand-written infrastructure.
- Guard real invariants (database constraints, authorization, one Admin per Club). Don't add
  locks, idempotency keys, or retries for races the product will not see.

## React

- Props interface: `I<ComponentName>Props`, declared next to the component.
- Components are `export default function Name(...)`, one per file; hooks and utilities use named
  exports. Related components may share a folder (`Button/ButtonLink.tsx`).
- Forms use `@mantine/form` with the shared zod-backed validator, and submit by calling their
  server action as an async function that returns `TFormResult` (`@/lib/form-errors`). Copy
  `app/(marketing)/contact/_components/ContactForm`.
- In `apps/frontend`, import through `@/` instead of `../../../`; relative paths are for the route or
  component folder you are in.
- Don't use `React.FC`; type props and the return value explicitly.
- Use `React.<Event>Event<HTML...Element>` for event handler types.
