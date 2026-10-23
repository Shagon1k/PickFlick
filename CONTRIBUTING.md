# Contributing to PickFlick

## Workflow

1. Select or create a focused issue in [Project 3](https://github.com/users/Shagon1k/projects/3).
2. Branch from `main` using `PF-TYPE-SHORT-DESCRIPTOR`.
3. Make focused commits following the [Git rules](.agent-docs/rules/git.md).
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

## Commits, pull requests and checks

[Git rules](.agent-docs/rules/git.md) define branch names, Conventional Commit messages, pull
requests and the hooks that check them; [GitHub issue rules](.agent-docs/rules/github-issues.md)
define Project 3 statuses and run authorization. Run `pnpm verify` before requesting review; CI
repeats it with integration, UI and image checks.
