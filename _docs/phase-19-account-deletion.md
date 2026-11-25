# Phase 19 — Account deletion

Working evidence for [#68](https://github.com/Shagon1k/PickFlick/issues/68). Project 3 owns status.
Keep this document while Phase 19 is active; consolidate durable evidence when the phase ends.

## Owner decisions and gates

The predecessor conversation preserves the owner's decision to keep comments as shared history.
Delete private profile, Library, Watchlist and files; replace attribution with “Deleted user”.
Do not automatically scan or rewrite free text. The owner deferred billing, company selection and
payment-provider choice. The 2026-11-16 continuation authorizes engineering implementation,
scoped commits and same-branch pushes. It does not accept legal/privacy policy or the UI preview.

Required before issue completion: an exact-head hosted preview and the owner's acknowledgment of
the destructive flow at mobile and desktop sizes. Legal/privacy sign-off, residual linkability,
free text, financial exceptions and backup/restore handling remain separate release gates.

## Implementation boundaries

- Reuse OAuth, existing Settings and ConfirmDialog. Prepare a same-account intent before OAuth;
  confirmation requires a different, unexpired session created after intent and within five minutes.
- One transaction persists deletion intent, replaces profile identifiers, ends active Memberships,
  revokes sessions/provider links, removes private rows, revokes outstanding invitations and records
  Club audit/mandatory adminless notifications. The existing Session departure flow ends open
  participation and rechecks phase completion. No shared contribution or comment is deleted.
- PostgreSQL guards reject private writes that arrive after deletion from an already authorized
  request. Accepted deletion seals the profile against late provider writes; profile/avatar mutations
  also require an active account.
- A PostgreSQL-locked sweep removes one tracked object per transaction. Failed storage deletion
  retains intent and retries after one minute. Export leases and upload deadlines fence cleanup;
  the export worker rechecks account and claim before uploading. Completion follows object cleanup
  and export-job removal. The 24-hour cleanup target is operational, not a guarantee during outages.
- #71 adds a billing hook: expiry of unfinished checkout and cancellation precede cleanup completion. `PENDING` retries on provider failure; `NOT_REQUIRED` or `CANCELLED` records completion. This does not delete provider-held financial records or accept their retention policy.

## Retained data and limitations

The retained User UUID and timestamps support shared foreign keys. Memberships, participant IDs,
selection snapshots and Club achievement evidence contain technical references, not copied names
or email addresses. Club audit events and the minimal deletion job remain for integrity and retry
proof. This removes profile attribution; it does not establish irreversible legal anonymization.
Comment text and other shared free text can identify people and need a separate privacy-request
process. Job/tombstone retention and restore reapplication await policy approval under #64/#83/#87/#88.
Suppression hashes, email webhook receipts, already delivered mail, provider copies and backups have
separate retention requirements. Already dispatched mail cannot be recalled.

Unattached avatar uploads remain in the existing orphan sweep (one-hour age, ten-minute interval).
Private access is denied immediately; archive cleanup waits for any active upload lease and its
thirty-second deadline. Losing an acceptance response can leave the browser unsure; sign-in checks
whether the old account is still active. Retrying cannot revive it. A later fresh registration uses
a new User UUID and does not reclaim old history.

## Verification

The eight focused integration tests use real Better Auth cookies and PostgreSQL. They verify
same-account/fresh-session requirements, strict confirmation and selector rejection, concurrent
acceptance, complete session revocation, blocked sign-in, anonymous shared projections, adminless
access/notifications, atomic rollback, storage retry/restart, in-flight export fencing and rejected
late private/profile writes. Open Sessions reuse the existing departure/completion workflow, so a
deleted non-submitter cannot hold Rating open; completed history stays intact. The physical-object case uses real S3-compatible MinIO storage and
checks object existence before acceptance and absence before job completion.

The synthetic before/after snapshot is asserted in the integration suite:

| Data                                          | Before deletion                              | After acceptance/cleanup                                     |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Profile                                       | Original name/email                          | Deleted user, synthetic tombstone email, no image/Appearance |
| Auth sessions / provider links                | Two sessions / one Google link               | Zero / zero; both original cookies denied                    |
| Owner Personal Ratings / Watchlist            | One / one                                    | Zero / zero                                                  |
| Peer Personal Ratings / Watchlist             | One / one                                    | One / one, unchanged                                         |
| Shared Session / nomination / ballot / rating | One each, comment and frozen Selection input | Same complete rows and JSON; comment unchanged               |
| Active Admin Membership                       | One                                          | Ended; peer retains Club access, new Session creation denied |
| Club audit / adminless notification           | None                                         | One deletion audit and one mandatory notice to the peer      |
| Tracked private objects                       | Avatar and archive attempts                  | Absent; tracking/export jobs removed before COMPLETE         |

The Settings privacy panel was compared with rendered `settings.html?tab=privacy` and the responsive
baseline at 390 and 1440 pixels. It preserves the existing shell, reading measure, danger tokens,
mobile recomposition and shared dialog. The compact rights/Notice summary follows DESIGN's policy
prose override; comment/history copy follows the owner's decision. Existing shared header/footer
behavior is inherited. New representative PNGs were generated in CI's digest-pinned Playwright
1.63.0 Noble image and inspected. Dialog captures target the overlay itself: a full-page capture
can move the sticky background header after mobile auto-scroll while the dialog stays unchanged.
The behavior checks cover OAuth initiation, explicit final
confirmation, keyboard submission, cancel/focus return, accessibility, no overflow, offline and
expired-reauth feedback, and the access-ended state.

Local verification under Node 24.15.0 / pnpm 11.25.0:

- All 695 unit tests pass. The latest focused deletion suite passes all eight tests, including the
  open-Session departure regression and physical MinIO cleanup.
- [CI run 43850829511](https://github.com/Shagon1k/PickFlick/actions/runs/43850829511) on
  `d7ce121e20830a857a3eb9e8595687e577622dff` passes all 371 integration tests across 41 files,
  all 695 unit tests, full lint/types/builds, production images, worker and E2E smoke, and all
  18 real-API browser journeys. This supplies the whole-suite evidence that longer local runs
  interrupted by SIGTERM could not provide.
- The final six deletion UI tests pass in the pinned image, including exact comparisons of all
  four inspected panel/dialog PNGs. The earlier Settings/auth regression selection passes all 22
  existing tests. Types and both production builds pass; focused lint, formatting, Knip and the
  production dependency audit are checked separately. The audit reports two low and six moderate
  findings, no high/critical findings. CI confirms the full static gate.
- The final migration applies from zero on task-owned PostgreSQL. The shared local database has
  an older failed migration and was left unchanged. Test MinIO uses a task-owned private bucket.

No exact-head hosted preview acknowledgment or legal/privacy acceptance is recorded. Live
Google/Apple credential exchange and provider-side deletion/retention are not verified by these
local tests.
