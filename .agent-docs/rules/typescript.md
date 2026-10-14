# TypeScript Rules

Write the obvious version. If a reader needs a comment to follow the control flow, simplify the
code instead.

`pnpm lint` enforces these rules and fails on warnings too; the pre-commit hook runs it on staged
files:

- the `I`/`T` prefixes and the ban on `Readonly<>`;
- sorted imports and inline `type` imports for types (Nest constructor injections stay value
  imports); `verbatimModuleSyntax` makes the compiler require them too;
- `*.spec.ts` test names;
- default-exported components and `components/<group>/<Name>/` folder names;
- type-aware checks (`recommended-type-checked`): no unawaited promises, no async callback where
  a sync one is expected, and exhaustive `switch` statements;
- JSX accessibility (`jsx-a11y-x` strict) and the Next.js rules (`core-web-vitals`), including
  `next/link` for internal navigation;
- the Vitest and Playwright plugin rules for tests (see [testing.md](testing.md));
- a 300-line file limit (500 for specs), cognitive complexity of 12 (15 for specs), and at most
  four function parameters outside specs;
- the naming rules below: boolean prefixes, `UPPER_SNAKE_CASE` constants, no single-letter names,
  `handleX` event handlers, and named numbers;
- `eqeqeq`, `no-else-return`, `object-shorthand`, `prefer-template`, and no commented-out code;
- the frontend import boundaries below.

Prettier wraps lines at 100 characters. The selectors live in
`packages/eslint-config/restricted-syntax.mjs`.

`pnpm typecheck` covers every package plus the root `tsconfig.json`, which holds the Playwright
specs, script tests, and config files.

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
- A boolean variable or parameter reads as a question: `is`, `are`, `has`, `can`, `should`,
  `was`, `did`, `will`, or `with` (`isOpen`, `hasDeadlineChanged`, `withDetails`); its state
  setter follows (`setIsOpen`). Destructured names keep the property they come from, and API and
  database fields keep their names (`permissions.manageSessions`, `hidden`).
- A function or method name is a verb phrase: `get`/`find`/`list` read, `build`/`create` make a new
  value, `to`/`format` convert, `assert` throws, `is`/`has` answer a question. Controller handlers
  follow it too (`listPending`, `getProgress`); the route lives in the decorator. Names a framework
  requires (`robots`, `sitemap`, `proxy`, Nest's static `register`, React components and `useX`
  hooks) and zod schema factories (`singleLineText`) are the exception.
- A component's own event handler is `handleX`; a prop that receives one is `onX`.
- A module-level constant set from a string, number, template, or literal arithmetic is
  `UPPER_SNAKE_CASE` (`MAX_SUGGESTIONS`, `DAY_MS`); lint enforces it. A boolean constant follows
  the boolean rule (`isEnabled`). Name a fixed lookup table or list `UPPER_SNAKE_CASE` too
  (`HTTP_STATUS`, `BLOCKING_SESSION_PHASES`); objects built for a library call (a Prisma `include`)
  stay camelCase.
- Collections are plural nouns without a type suffix (`members`, not `memberList`), and a callback
  names the item it receives (`members.map((member) => ...)`). Single letters are only `a`/`b` in
  a sort comparator, `i` in a counter loop, and `_` for an unused position.
- Privacy uses TypeScript's `private`; never prefix a member with `_` or `#`.
- A number inside logic gets a name as a module-level constant. Constant initializers may hold
  arithmetic and schema limits (`7 * DAY_MS`, `.max(200)`); 0, 1, 2, defaults, enums, and types
  are exempt, and tests keep literal expectations. Take a limit the schema already owns from
  `@pickflick/contracts` (`SESSION_NOTES_MAX_LENGTH`) instead of repeating it. String literals
  stay inline: their union types already catch a typo.

## Validation

- Request, form, and environment shapes are zod schemas. Shared request/response schemas live in
  `@pickflick/contracts`; infer types with `z.infer` instead of writing them twice.
- Name schemas `<thing>Schema` (`createClubSchema`) and inferred types `T<Thing>`
  (`TCreateClubRequest`).

## Comments

- Comment the why, not the what. Explain a non-obvious decision or workaround; delete narration
  that repeats the code.
- Keep legal notices, informative comments (a format, a unit, a protocol fact), intent, and
  warnings about consequences. Drop noise, journaling, closing-brace labels, and comments that
  repeat a neighbouring one.
- Delete commented-out code; `sonarjs/no-commented-code` enforces it.
- Track later work as a Project 3 issue, not a `TODO` comment; `sonarjs/todo-tag` rejects them.

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
