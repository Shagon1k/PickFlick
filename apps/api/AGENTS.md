# API

NestJS (TypeScript, ESM). Feature modules live in `src/modules/`; a global authentication guard
protects every route unless it has `@Public()`.

## Rule index

- TypeScript: `../../.agent-docs/rules/typescript.md`
- Tests: `../../.agent-docs/rules/testing.md`
- Git: `../../.agent-docs/rules/git.md`

## Structure

- `src/main.ts` and `src/app.module.ts` only compose the app.
- `src/config/` holds runtime environment wiring; `src/common/` holds cross-feature filters,
  pipes, and helpers; `src/database/` owns the single Prisma client.
- A feature is `src/modules/<feature>/` with `<feature>.module.ts`, `<feature>.controller.ts`, and
  `<feature>.service.ts`. Add role folders (`dto/`, `guards/`, `decorators/`, `providers/`,
  `repositories/`) only when the module grows past roughly eight files.
- Copy `src/modules/contact` as the template for a new module.

## Requests

- Validate bodies with `ZodValidationPipe` and a schema from `@pickflick/contracts`:
  `@Body(new ZodValidationPipe(createClubSchema)) body: TCreateClubRequest`. Don't re-validate in
  services.
- Services throw Nest exceptions (`NotFoundException`, `ConflictException`, ...). Pass a stable
  reason when the client needs to distinguish causes: `new ConflictException({ reason })`.
- Never hand-format error responses; `ApiExceptionFilter` owns the envelope.

## Authorization

- Enforce access in the service or repository query (`where: { clubId, userId }`).
- A Club the caller cannot see is `NotFoundException`, never a hint that it exists.

## Integrations

- External clients (Resend, S3) sit behind an injection token so tests can swap them.
- Build them from the validated runtime environment; never read `process.env` in a feature.
