# GitHub Tasks and Issues

## Canonical Tracker

```yaml
repository: Shagon1k/PickFlick
project:
  owner: Shagon1k
  number: 3
  url: https://github.com/users/Shagon1k/projects/3
```

GitHub Issues in Project 3 are the source of truth for delivery workflow state.

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
