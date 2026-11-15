# Phase 19 — Personal data archives

Implementation evidence for [#67](https://github.com/Shagon1k/PickFlick/issues/67). Project 3 owns
live status. Keep this document while Phase 19 is active, then consolidate evidence into the Roadmap.

## Scope

Use the [recorded owner approval](phase-19-privacy.md#owner-implementation-approval-for-67-2026-11-14)
and existing data inventory. Reuse private StorageService, Prisma, the global authentication guard,
strict contracts and the existing Nest background-sweep pattern. Add durable jobs/attempt-object
tracking, own-data projection, manifest, bounded retries, signed authenticated downloads and fixed
seven-day expiry. The [archive reference](gdpr-archives.md) records the exact field allowlist,
exclusions, protocol, failure recovery and operational limits.

No Settings UI, public legal copy, deletion, retention-policy expansion, new provider/dependency,
environment variable, separate worker process or deployment is included. The personal ratings CSV
remains synchronous; its existing Roadmap architecture discrepancy is not resolved by #67.
Outstanding #64 policy/legal checkpoints remain open. This delivery does not approve merge, launch
or deployment.

## Verification

- The focused database/API/archive suite passes 13 tests against task-owned PostgreSQL, Redis
  and MinIO. It inspects a populated two-user archive, its manifest/digests, own contributions,
  avatar bytes and explicit absence of peer identities, credentials, invitation digests, shared
  snapshots and operational payloads.
- Coverage includes non-blocking enqueue, duplicate/concurrent requests, strict input, ownership,
  signed-link tampering, anonymous/peer denial, exact expiry, slow-read expiry, account deactivation,
  missing objects, bounded retries, restart recovery, final-claim exhaustion, late-worker fencing,
  failed deletion and durable orphan cleanup. Real MinIO denies anonymous artifact reads (`403`)
  while the authenticated signed application download succeeds.
- `pnpm verify` passes under Node 24.15.0 / pnpm 11.25.0: production dependency audit, full lint,
  Knip, formatting, workspace/test types, all 685 unit tests and both production builds. The audit
  reports two low and six moderate findings, with no high/critical production findings.
- The full integration suite passes all 360 tests across 40 files after loading the required
  deterministic seed into the task-owned test database. The initial unseeded run failed six
  existing fixture-dependent constraint checks; the seeded full rerun resolves them.
- The final migration SQL also passes a transactional isolated-schema probe, including rejection
  of duplicate active jobs and READY jobs without an expiry. All changed local document links and
  `git diff --check` pass.

No rendered UI changed, so new visual baselines and hosted visual approval are not part of #67.
The owner/legal/privacy reviewer still owns public-copy, provider, shared-history, metadata-retention,
financial and backup decisions. Physical artifact cleanup retries during outages; seven-day download
authorization remains fixed. Very large accounts may require future streaming rather than the
current in-memory generation path.

## Review fix round 1

Storage deletion now uses the existing thirty-second abort deadline. A timeout retains the tracking
row and lets generation continue; the next sweep retries cleanup. Job claims capture a fresh time
after cleanup so slow deletions do not consume the five-minute generation lease.

The focused archive suite passes all 15 tests against isolated PostgreSQL, Redis and MinIO. New
regressions cover a stalled deletion followed by successful generation and cleanup on the next
sweep, and twenty sixteen-second deletions followed by successful publication on the first attempt.

`pnpm verify` passes under Node 24.15.0 / pnpm 11.25.0, including all 685 unit tests and both
production builds. The full integration suite passes all 362 tests across 40 files. A built
StorageService probe against a nonresponding local HTTP server confirms that S3 DELETE aborts
after a one-second test deadline (observed 1009 ms). Local document links and `git diff --check` pass.
