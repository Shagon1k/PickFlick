# Git Rules

## Branching strategy

- Use GitHub Flow: branch from `main`, keep each branch focused, and merge through a PR.
- `main` represents the best verified repository state.
- One logical issue per branch when practical; do not mix opportunistic refactors into delivery work.

## Branch naming

```text
PF-TYPE-SHORT-DESCRIPTOR
```

`TYPE` matches a Conventional Commit type: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`,
`perf`, `build`, `ci`, or `style`.

Examples:

```text
PF-feat-google-oauth
PF-fix-session-transition-lock
PF-docs-project-workflow
```

Roadmap phases are planning context, not branch names. Link the focused Project issue that the
branch delivers.

## Commit messages

```text
TYPE(SCOPE): IMPERATIVE SUBJECT
```

- Use lowercase imperative wording, no trailing period, and a subject under 72 characters.
- Keep one logical change per commit.
- Structural refactors require approval and a separate behavior-neutral commit.
- Never bypass a repository hook once hooks exist.
- Never commit without explicit developer approval.

## Pull requests

- PR titles follow Conventional Commits because squash merge uses the title as the final commit.
- Link the owning issue from [Project 3](https://github.com/users/Shagon1k/projects/3), normally with
  `Closes #NUMBER`.
- State acceptance evidence, not intent.
- Call out new environment variables, migrations, infrastructure, privacy/security risk, or
  `none` explicitly.
- Use squash merge to keep one logical commit on `main`.
- Never push or open a PR without explicit developer approval.

## Worktree safety

- Inspect `git status --short` before editing.
- Preserve unrelated user changes and understand overlapping changes before touching them.
- Never reset, revert, overwrite, or delete user work without explicit approval and exact targets.
