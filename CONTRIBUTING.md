# Contributing to PickFlick

## Workflow

1. Select or create a focused issue in [Project 3](https://github.com/users/Shagon1k/projects/3).
2. Branch from `main` using `PF-TYPE-SHORT-DESCRIPTOR`.
3. Make focused commits following [Conventional Commits](#commit-message-format).
4. Open a PR whose title follows Conventional Commits and whose body links the Project issue.
5. Report acceptance evidence and call out environment variables, migrations, or infrastructure
   impact explicitly.
6. Squash merge to `main` after review.

## Issue workflow

- Project 3 is the only source of truth for actionable active and deferred delivery work.
- `Deferred` issues are excluded from autonomous selection until their activation trigger is met.
- Autonomous work may select only `Backlog` issues without the `human-control` label.
- `human-control` keeps development interactive with the owner; it does not prohibit AI assistance.
- A PR produced autonomously moves to `[AI] Human Review` when it is ready for owner review.
- `ROADMAP.md` remains the product/MVP/phase contract and phase-level acceptance record, not a
  duplicate issue backlog.

## Commit message format

```text
TYPE(SCOPE): SUBJECT
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `style`.

Use imperative mood, lowercase, no trailing period, and keep the subject under 72 characters.

Examples:

```text
feat(auth): add Google OAuth callback
fix(clubs): enforce one blocking session
docs(project): align GitHub delivery workflow
```

## Current enforcement

The pinned pnpm workspace enforces install-time engine and peer-dependency checks. Run `pnpm verify`
before requesting review; it covers lint, type-checks, unit tests, workspace-boundary checks, and
production builds. Commit-message and pull-request conventions remain review-enforced because the
repository does not install commit hooks yet.
