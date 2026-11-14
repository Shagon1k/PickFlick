# Personal data archives

The authenticated `data-exports` backend module creates a gzip-compressed JSON archive containing
the requester's stored data. Version 1 contains `manifest` and `data` objects. It is separate from
the synchronous [personal ratings CSV](ratings-csv.md). The
[owner implementation approval](phase-19-privacy.md#owner-implementation-approval-for-67-2026-11-14)
defines its engineering boundary; legal/privacy sign-off remains open.

## API

All routes require an active authenticated user, take identity from the session, and return
`Cache-Control: private, no-store`. Unknown body/query fields are rejected. Paths below are backend
paths; the browser uses the `/api` prefix.

| Method and path                                                | Input and result                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /account/data-exports`                                   | `{ "requestId": "<UUID v4>" }`; returns `202` with a job status immediately. Three requests per ten minutes per client address.    |
| `GET /account/data-exports/:id`                                | Returns only the requester's job status; a foreign or nonexistent job returns `404`.                                               |
| `POST /account/data-exports/:id/download-link`                 | Empty JSON object; returns a relative signed URL for a READY job.                                                                  |
| `GET /account/data-exports/:id/download?expires=…&signature=…` | Returns `application/gzip` as `pickflick-data.json.gz`, after verifying the signature, identity, account state and both deadlines. |

Retain the client-generated request UUID until the request succeeds. Repeating it returns the same
job, including after failure or expiry. A different request while a job is PENDING/PROCESSING
returns `409 EXPORT_IN_PROGRESS`. After terminal failure or expiry, submit a new UUID to request
another archive. Status includes the job ID, state, attempt count, creation/completion/expiry times,
next retry time and a fixed failure reason; it never contains keys, credentials or content.

## Version 1 inventory

Each database query selects only the fields below and filters by the requester's User, Membership,
SessionParticipant, recipient or contribution. Shared IDs provide context without exporting peer
attribution. `SelectionScore` and `PastSelectionScore` are the requester's responses, including
when the referenced nomination belongs to a peer. Session Ratings and Personal Ratings stay separate.

| `data` section            | Included fields                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile`                 | `id`, `email`, `emailVerified`, `displayName`, `locale`, `appRole`, `status`, `isAvatarRemoved`, validated personal `appearance`, `createdAt`, `updatedAt`        |
| `providers`               | Own `provider`, `providerSubject`, `scope`, `createdAt`, `updatedAt`                                                                                              |
| `authSessions`            | Own `id`, `ipAddress`, `userAgent`, `createdAt`, `updatedAt`, `expiresAt`; no tokens                                                                              |
| `personalRatings`         | `movieId`, `score`, `source`, `updatedAt`                                                                                                                         |
| `watchlist`               | `movieId`, `priority`, `addedAt`                                                                                                                                  |
| `memberships`             | Own `id`, `clubId`, `role`, `status`, `joinedAt`, `leftAt`, `updatedAt`                                                                                           |
| `participation`           | Own `id`, `sessionId`, `clubId`, `membershipId`, `status`, `attended`, `createdAt`, `updatedAt`                                                                   |
| `nominations`             | Own `id`, `sessionId`, `movieId`, `submittedAt`, `isInSelection`                                                                                                  |
| `ballots`                 | Own `id`, `sessionId`, `submittedAt`; own nested `scores` contain `nominationId`, `score`, `nomination.movieId`                                                   |
| `pastNominations`         | Own attributed `id`, `sessionId`, `movieId`                                                                                                                       |
| `pastScores`              | Own `nominationId`, `sessionId`, `score`, `nomination.movieId`                                                                                                    |
| `sessionRatings`          | Own `id`, `sessionId`, `score`, authored `comment`, `submittedAt`                                                                                                 |
| `achievements`            | Personal awards only: `id`, `key`, `version`, `title`, `description`, `target`, `progress`, `private`, `awardedAt`                                                |
| `notifications`           | Recipient's `id`, `event`, `inApp`, `email`, `readAt`, `createdAt`; optional `emailDelivery` contains `status`, `attemptCount`, `firstAttemptAt`, `nextAttemptAt` |
| `notificationPreferences` | Own `event`, `inApp`, `email`                                                                                                                                     |
| `invitations`             | Invitations created by, targeted at or answered by the requester: `id`, `clubId`, `createdAt`, `expiresAt`, `revokedAt`; no identities, secrets or peer responses |
| `invitationResponses`     | Only responses made by the requester: `id`, `clubId`, `respondedAt`, `accepted`                                                                                   |
| `auditEvents`             | Events involving the requester as actor or subject: `id`, `clubId`, `sessionId`, `action`, `changed`, `createdAt`; no peer attribution                            |
| `roleChanges`             | Events with the requester as subject: `id`, `clubId`, `action`, `previousRole`, `nextRole`, `createdAt`                                                           |
| `exportJobs`              | Own `id`, `status`, `attemptCount`, `createdAt`, `completedAt`, `expiresAt`, `failure` at snapshot time                                                           |
| `avatar`                  | Current uploaded personal avatar as `contentType` and `base64`, or `null`; no provider photo fetch                                                                |

The database snapshot uses Repeatable Read. Avatar bytes are read from its captured current object
key; an unavailable captured upload fails generation rather than silently omitting it. The manifest
lists sections, present top-level field names and a SHA-256 digest of `JSON.stringify(section)`.
Empty arrays have no present field names. It also explains the format, availability, exclusions,
shared-history preservation and actual/proposed provider boundaries.

Excluded: credentials, tokens, OAuth state, invitation digests, object/signing keys, other users'
profiles and responses, Club/Session free text and rosters, frozen Selection JSON, achievement
evidence/explanations, progress/deadline payloads, provider-hosted photos, shared catalog/media,
Club awards/avatars, address hashes, internal delivery identifiers/reasons, abuse counters,
suppression and webhook records. Own authored Session Rating comments are included as contributions.
Provider/mailbox, application/edge log and backup copies are outside this database/object archive.
The manifest discloses those exclusions; this is not a legal-compliance certification.

## Lifecycle and operations

`DataExportJob` persists PENDING → PROCESSING → READY, with PENDING retries or terminal FAILED.
The API process sweeps every five seconds, claims one due job using `FOR UPDATE SKIP LOCKED`, and
uses a five-minute lease and claim token. Concurrent instances cannot claim the same current
attempt. A crashed process is recoverable after its lease expires. Generation failures retry after
one minute, up to three claims; an interrupted final claim becomes FAILED after expiry. Failure
reasons are `GENERATION_FAILED` or `ACCOUNT_UNAVAILABLE`.

Each attempt registers a private opaque `DataExportObject` key before upload. Attempts never
overwrite another attempt's artifact. Only the current unexpired claim may publish READY while the
User is ACTIVE. The database and compression work runs outside request handling. The database
snapshot has a sixty-second timeout; avatar reads and uploads have thirty-second abort deadlines.
Generation currently materializes one user's archive in memory; very large accounts may exhaust
resources and require a future streaming implementation. No queue dependency or separate process
is added.

Successful publication sets a fixed expiry seven days after completion. Download links are HMAC
SHA-256 signatures using a random per-job key, bound to job, user and deadline. They last at most
five minutes and never exceed archive expiry. The download endpoint rechecks active ownership and
both deadlines after storage reads. Sharing the URL grants no peer access. Missing artifacts return
`503 EXPORT_OBJECT_UNAVAILABLE`; no replacement or extended expiry is silently created.

READY jobs become EXPIRED at the seven-day deadline or when the account becomes inactive. Downloads
deny access immediately, even while the API worker is stopped or storage cleanup fails. Sweeps
delete expired artifacts and abandoned attempt objects after one hour, in batches of twenty;
failed deletions keep their tracking rows for the next sweep. API availability and storage recovery
therefore affect physical deletion timing, never the download deadline. Job/metadata retention,
backups and account deletion remain separate policy/delivery work. Restrictive foreign keys retain
cleanup evidence: #68 must remove tracked objects before deleting export jobs or the User.

Structured events expose `export.attempt.started`, `export.retry.scheduled`, `export.ready`,
`export.failed`, `export.claim.superseded`, `export.claims.exhausted`, `export.object.deleted`,
`export.cleanup.failed` and `export.cycle.failed`. Logs carry only opaque job IDs, attempt/count and
fixed reasons, never content, addresses, keys, signed URLs or provider exception text. HTTP logging
already redacts URLs, referrers, cookies, authorization and Location headers.

Use the database for status, retry counts and overdue cleanup evidence without reading archive data:

```sql
SELECT status, count(*), sum("attemptCount") AS claims
FROM "DataExportJob" GROUP BY status;

SELECT count(*) AS overdue_objects
FROM "DataExportObject" WHERE "deleteAfter" <= now();
```

For failures, restore database/storage availability and allow the normal retry/sweep. After three
failed claims, the user can submit a new request UUID. Do not extend an existing job's deadline or
publish a storage URL. Broader monitoring, legal copy, provider retention, backup handling and
deletion acceptance remain with their existing issues.
