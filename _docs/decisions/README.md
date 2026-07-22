# PickFlick Architecture Decision Records

> Durable record of significant technical decisions and why they were made.
> [ARCHITECTURE.md](../../ARCHITECTURE.md) describes the proposed/current system; [ROADMAP.md](../../ROADMAP.md) owns unresolved and deferred work.

## Statuses

| Status | Meaning |
| --- | --- |
| `Proposed` | A concrete decision is under review and is not current direction. |
| `Accepted` | The developer approved the decision; it is current direction. |
| `Rejected` | A concrete proposal was declined; rationale is preserved. |
| `Superseded` | A later ADR replaces an accepted decision and links both records. |

## Registry

No ADR has been accepted yet. The application is greenfield and the architecture remains Proposed.

Phase 1 should create sequential records only when it evaluates and decides durable choices such as topology, authentication/session boundary, database/migration workflow, async/outbox strategy, deployment, or the production UI primitive layer. Do not create an ADR for routine implementation details.

When the first decision is ready, add `ADR-001` to an index here and append its full record. Never reuse or renumber an ID, and never rewrite accepted history; supersede it with a new record.
