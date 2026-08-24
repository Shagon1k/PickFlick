# GitHub Tasks and Issues

## Canonical Tracker

```yaml
repository: Shagon1k/PickFlick
project:
    owner: Shagon1k
    number: 3
    url: https://github.com/users/Shagon1k/projects/3
templates:
    bug: .github/ISSUE_TEMPLATE/bug.yml
    feature: .github/ISSUE_TEMPLATE/feature.yml
    tech_debt: .github/ISSUE_TEMPLATE/tech-debt.yml
    discovery: .github/ISSUE_TEMPLATE/discovery.yml
```

Issue type is encoded once in the title prefix supplied by the selected template
(`[Bug]`, `[Feature]`, `[Tech debt]`, or `[Discovery]`). Do not add labels that duplicate
that type. `human-control` remains a workflow label and is added only when the owner must
stay involved during development.

## Request Routing

```text
request explicitly says implement / fix / change code
  -> perform the code task

request says create / add a task, ticket, or issue
  -> create a GitHub issue and add it to Project 3
  -> do not edit code or archived planning files

request explicitly asks to correct historical roadmap/design information
  -> edit the relevant archive only; do not create active scope implicitly

request defers work until a stated condition is met
  -> create or update an issue and set Project status to Deferred

ambiguous "add a task to the project"
  -> default to a GitHub issue in Project 3
```

## Project Status Semantics

```text
Deferred
  -> inactive; an observable activation condition has not been met
  -> orchestrator must never start a run

Backlog
  -> ready for owner selection
  -> no run has started

In progress
  -> owner explicitly requested a run
  -> autonomous and human-controlled runs both remain here until a reviewable result exists

Human Review
  -> a PR, preview, artifact, or decision is ready for owner review

Done
  -> owner accepted the result
```

The orchestrator never selects work from Backlog automatically. Moving an issue to
In progress is the explicit start signal. Move a Deferred issue to Backlog only after
its activation condition is evidenced.

## Interaction Policy

```text
human-control absent  -> autonomous
human-control present -> human_control
```

The label changes only the interaction and approval policy. It does not create a
different execution model.

## Run Authorization

For an issue without `human-control`, moving it to In progress authorizes an
issue-scoped run to create a worktree and branch, make commits, push the branch, and
open a Draft PR.

For an issue with `human-control`, the same transition authorizes run preparation
and analysis. Mutating implementation waits for the required owner checkpoint.

Neither policy authorizes merging, production deployment, destructive operations,
secret disclosure, or bypassing risk guards.

## Issue Creation

1. Search open and closed issues for a duplicate before creating anything.
2. Classify the work:
    - observed behavior differs from the product promise -> `bug.yml`
    - user-facing capability or product improvement -> `feature.yml`
    - maintainability, reliability, or operational cost -> `tech-debt.yml`
    - evidence-backed product, provider, design, or technical decision before implementation -> `discovery.yml`
3. Read the selected template and preserve its title prefix, required sections, and
   acceptance-criteria format. API-created issues must mirror the form in Markdown because
   creating an issue through an API does not submit the Issue Form itself. Do not add a
   type label; add `human-control` only when its workflow semantics apply.
4. Keep the issue outcome-focused and small enough for one focused pull request when
   practical. Acceptance criteria must be observable.
5. Create the issue in `Shagon1k/PickFlick`.
6. Ensure the issue is in `Shagon1k` Project 3. Prefer the project's auto-add workflow; if it
   is unavailable, add the issue explicitly with a GitHub Project-capable tool.
7. Set the Project status to `Deferred` when its activation trigger is not yet met;
   otherwise leave it in `Backlog`.
8. Report the issue URL, selected template, any workflow labels, status, and confirmed project
   membership.

Do not claim completion if project membership cannot be verified. State exactly which
permission, authentication, or tool capability is missing.
