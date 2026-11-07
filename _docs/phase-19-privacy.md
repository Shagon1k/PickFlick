# Phase 19 — Profile, privacy, portability, and account deletion

This working reference prepares the policy decision for
[#64](https://github.com/Shagon1k/PickFlick/issues/64). Project 3 owns live issue status;
[Roadmap Phase 19](../ROADMAP.md#phase-19--profile-privacy-importexport--account-deletion--in-progress)
owns scope and acceptance. Runtime implementation belongs to #65–#69, retention enforcement to
#87, and backup operations to #83 and #88. This document does not approve policy or public copy.

Evidence reviewed on 2026-11-07 at `db768009273baaf698b1d9045b7ebe229d349e17`.
The supplied predecessor conversation contains preparation only. No new policy approval for #64
or legal/privacy sign-off was found in that handoff or the issue discussion.

## Existing requirements

- Account deletion removes private profile, Membership access, personal Library and Watchlist
  data, revokes sessions, and handles subscription cancellation through an audited workflow.
- Shared Club and Session history survives with anonymized attribution. A Club whose Admin
  deletes their account becomes adminless unless administration was transferred; notify members
  and disable owner-only actions. Ownership recovery remains outside Phase 19.
- The personal CSV and private expiring archive expose only the requesting User's data. Shared
  records require a disclosure rule that protects other members.
- The Roadmap sets inactive Club archiving at 90 days for Free and 180 days for Pro, with Admin
  notice and reactivation. Archiving never means automatic Club deletion. This feature is unbuilt.
- Public privacy and terms entries remain explicitly provisional. Prototype numbers and the
  cookie-banner assertion are not approved policy.

Sources: [account deletion](../ROADMAP.md#account-deletion-and-shared-history),
[plans and limits](../ROADMAP.md#plans-and-limits), [Phase 19](../ROADMAP.md#phase-19--profile-privacy-importexport--account-deletion--in-progress),
and [legal entry source](<../apps/frontend/src/app/(marketing)/legal/[document]/legal-content.ts>).

## Data inventory

All current Prisma models are covered below. These are schema and source observations, not a
claim that deployed providers or cleanup schedules have been inspected. Retention decisions use
the IDs in the next section. Stored IDs and hashes can still link to a person.

| Records or storage                                                                                         | Data and purpose                                                                                                                                                        | Deletion/export review needed                                                                                                                                                | Policy          |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `User`                                                                                                     | Email, display name, provider image reference, locale, roles/status and timestamps; account identity.                                                                   | Remove private values; decide how retained shared references stop identifying the person. Uploaded personal avatars are planned, not built.                                  | P1, P2          |
| `AuthSession`, `ProviderAccount`                                                                           | Session credential, IP/user-agent, expiry, provider subject and timestamps; access. Provider token columns exist, but auth hooks clear OAuth tokens before persistence. | Revoke all sessions; remove provider identity. Never put credentials in an export.                                                                                           | P1, P6          |
| `AuthVerification`, `AuthRateLimit`                                                                        | OAuth state with expiry; request keys, counts and timestamps for abuse limits.                                                                                          | Decide expired-row cleanup and whether request keys identify a User or address. Logical expiry does not prove physical removal.                                              | P6              |
| `Club`, `Membership`, `ClubInvite`                                                                         | Club text/avatar, roles, current and former Memberships, invitation digests, creator/target/responder IDs and expiry.                                                   | Preserve shared records without restoring deleted-user access or leaking invitation credentials. End invitation eligibility and scrub attribution under the approved design. | P1, P2, P6, P7  |
| `Session`, `SessionParticipant`                                                                            | Session text, location, dates, attendance and Membership links; frozen Selection result JSON.                                                                           | Preserve shared history. Review free text and JSON for identifiers beyond display names.                                                                                     | P2              |
| `Nomination`, `PastNomination`, `SelectionBallot`, `SelectionScore`, `PastSelectionScore`, `SessionRating` | Movie choices, individual scores, comments and participant links.                                                                                                       | Preserve shared results; define treatment of identifying comments and imported attribution. Exports must not expose peers' hidden scores or comments.                        | P2, P3          |
| `NominationDeadlineDecision`, `SessionProgressEvent`, `ClubAuditEvent`                                     | Transition decisions, recipient Membership IDs, actor/subject IDs, action and time; correctness and audit evidence.                                                     | Decide separate retention purposes; references and recipient arrays require anonymization review.                                                                            | P2, P5          |
| `PersonalMovieRating`, `WatchlistItem`                                                                     | Private personal scores, sources, priorities and timestamps.                                                                                                            | Include own data in portability scope; remove on account deletion.                                                                                                           | P1, P3, P7      |
| `AchievementAward`                                                                                         | Personal or Club awards, explanation and JSON evidence.                                                                                                                 | Remove personal awards; inspect Club evidence for retained personal references.                                                                                              | P1, P2, P3      |
| `Notification`, `NotificationPreference`, `NotificationEmailDelivery`                                      | Recipient and entity references, preferences, read state, delivery status, provider IDs and address hash.                                                               | Remove private recipient data on deletion; define completed/failed-job retention separately from pending delivery.                                                           | P1, P3, P5      |
| `NotificationEmailSuppression`, `NotificationEmailWebhook`                                                 | Address hashes/reasons and provider receipt IDs/types/times; suppression and deduplication.                                                                             | Not directly linked to User by foreign key. Decide suppression retention and replay protection before purging.                                                               | P5              |
| `Movie`, `MovieExternalId`, `MovieDetailsCache`, `MovieSearchCache`                                        | Catalog IDs, titles, provider JSON and timestamps; shared catalog cache.                                                                                                | Distinguish provider content/cache retention from personal history; inspect search-cache payloads before calling them non-personal.                                          | P8              |
| Private object storage                                                                                     | Club avatars and catalog images now; personal avatars, imports and export artifacts later.                                                                              | Cover replaced, failed, abandoned and unreferenced objects; link artifact expiry to physical cleanup.                                                                        | P1, P4, P8      |
| Contact email and destination mailbox                                                                      | Optional name/email and message sent via the email adapter; no Contact database row.                                                                                    | App database deletion does not erase provider or mailbox copies. Decide support purpose, access and deletion procedure.                                                      | P9              |
| Runtime/edge logs, backups and recipient inboxes                                                           | Operational metadata; snapshots of PostgreSQL/objects; delivered email outside the application.                                                                         | Verify actual host/provider retention and limits on deletion. Never promise deletion from another member's inbox.                                                            | P9, P10         |
| Proposed billing and export records                                                                        | Paddle subscription/customer/event references; archive job, manifest and download artifact. No billing or export job model exists yet.                                  | Decide obligations and expiry before implementation; separate statutory billing records from profile deletion.                                                               | P1, P3, P4, P10 |

Inventory evidence: [Prisma schema](../packages/database/prisma/schema.prisma),
[auth configuration](../apps/backend/src/modules/auth/auth.config.ts),
[progress event writer](../apps/backend/src/modules/sessions/session-progress.ts),
[Contact service](../apps/backend/src/modules/contact/contact.service.ts),
[email operations](email-delivery.md), [environment logging contract](environment.md#health-errors-and-logs),
and [architecture data boundaries](../ARCHITECTURE.md#3-data).

`Membership`, `ClubAuditEvent` and other history relations currently use restrictive foreign keys.
A plain User delete is not the deletion design. #68 must reconcile those relations, JSON evidence,
free text and object references without erasing shared history. Replacing a display name alone
does not establish anonymization; the privacy reviewer must assess remaining linkability.

## Retention and behavior decision matrix

**Every P-row is pending product-owner and legal/privacy approval.** Existing requirements above
remain authoritative; the dispositions below are engineering proposals and questions for review.
No numeric value below is a newly approved retention period.

For each duration, record the value and unit, clock start, maximum cleanup delay, exception/hold
conditions and handling of failure. “Expires” must distinguish denied access from physical deletion.

| ID                               | Proposed disposition or existing constraint                                                                                           | Decision required before dependent work                                                                                                                                                                                                                          | Implementation / copy                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P1 — Account deletion            | Re-authenticate, revoke access, remove private data, cancel billing and audit progress; keep shared history anonymized.               | Approve request-response target and completion maximum, their clock starts, cancellation/grace policy, failure escalation, and any restricted legal exceptions. Define subscription failure behavior without leaving account access active.                      | #68, #69, #87; Privacy and destructive confirmation      |
| P2 — Shared history              | Preserve Club/Session records and aggregates; unlink personal identity and remove identifying private material under a reviewed rule. | Approve retained fields and purpose, duration/review trigger, free-text/JSON treatment, tombstone linkage, and adminless notifications. Decide what can remain identifiable and why.                                                                             | #68, #69, #87; history and deletion disclosures          |
| P3 — Export scope and timing     | Separate personal ratings CSV from the full personal archive; exclude secrets and peers' private data.                                | Approve a field-level manifest, shared-record redaction, provider-held-data disclosure, request/processing target, and treatment of a pending export when deletion begins. Access requests and CSV portability need distinct scope review.                       | #66, #67, #69; Settings and archive manifest             |
| P4 — Export expiry               | Private authenticated download, explicit expiry and eventual object/job cleanup.                                                      | Set download lifetime from readiness, underlying URL lifetime if used, artifact purge delay, and completed/failed job metadata retention. Decide revocation on account deletion and whether regenerated archives replace old artifacts.                          | #67, #68, #69, #87                                       |
| P5 — Audit and delivery evidence | Keep minimal evidence for a stated security, shared-history or delivery purpose.                                                      | Set periods from event/terminal time for audit, progress/deadline records, notifications/delivery jobs, webhook deduplication and suppression hashes. Approve exceptions and who can authorize them; preserve idempotency over the approved replay window.       | #68, #78, #87; audit settings and Privacy                |
| P6 — Auth and invitation residue | Preserve the existing seven-day rolling session and new Club link twelve-hour expiry behavior until separately changed.               | Set physical cleanup delays for expired sessions, OAuth state, rate-limit rows and invitation digests/attribution. Do not confuse access validity with data retention.                                                                                           | #68, #87; auth/cookie disclosure                         |
| P7 — Inactivity                  | Club archiving uses existing plan grace periods and preserves history.                                                                | Define the activity clock and notification lead time in #74. Separately decide whether inactive User/private data has a retention period, notice, exceptions and deletion trigger; no automatic User purge is approved.                                          | #69, #74, #87                                            |
| P8 — Objects and caches          | Retain referenced shared media; remove approved abandoned/private artifacts.                                                          | Set orphan/replaced-upload grace and cleanup delay; catalog/search-cache retention and classification. Cache freshness settings are not retention guarantees.                                                                                                    | #65, #68, #87                                            |
| P9 — Logs, Contact and providers | Apply separate purpose-based rules to support mail, logs and external copies.                                                         | Set log and support/mailbox periods from receipt/event/closure; name operators and confirm provider-side retention/deletion limits. Include edge logs, delivery data and recipient copies in the notice.                                                         | #69, #86, #87; Privacy and operations                    |
| P10 — Backups and billing        | Align live erasure with restricted backup expiry and restoration; separate billing obligations.                                       | Approve database/object backup maximum age, expiry delay, access, exceptions and procedure to reapply deletions before restored data is served. Confirm provider backups and jurisdiction-specific billing-record periods. #83 owns destination/RPO/RTO choices. | #68, #69, #83, #88; Privacy, billing and restore runbook |

## Provider and cookie disclosure review

| Integration / browser surface          | Verified repository behavior                                                                                                                                                                                                                           | External evidence or decision still required                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google / gated Apple                   | Google sign-in requests `openid email profile`; provider subject/profile stored, OAuth tokens cleared. Apple adapter exists but activation is gated. Provider photos are fetched by the server through bounded same-origin endpoints.                  | Confirm launch providers, legal roles, terms, transferred fields, locations and retention. Do not describe Apple as active.                                                                                                                               |
| Resend / support mailbox               | Contact and notification emails can contain personal content. Delivery rows store references/hashes, not rendered email. Operations require open/click tracking disabled; actual provider configuration was not inspected.                             | Confirm account configuration, recipient mailbox operator, agreement, regions, subprocessors, retention and deletion capability. Provider-side content is separate from application logs.                                                                 |
| PoiskKino + TheTVDB / alternative TMDB | Configured catalog adapters receive searches/IDs; server fetches media. Browser media comes from same origin.                                                                                                                                          | Confirm selected launch source, query data sent, rights/attribution and applicable provider terms. No claim that proxying eliminates server-to-provider disclosure.                                                                                       |
| YouTube                                | Player iframe loads from `youtube-nocookie.com` after Play; thumbnails use the backend proxy.                                                                                                                                                          | Review consent and disclosure for actual playback/network/storage behavior. Privacy-enhanced mode does not by itself establish a consent exemption.                                                                                                       |
| Hosting, storage, Cloudflare and logs  | PostgreSQL, private S3-compatible objects, host/edge request processing; Redis carries ephemeral recipient-ID invalidation signals without notification content or configured persistence.                                                             | Name actual vendors, locations, access, agreements and backup/log periods. No live account inspection was performed.                                                                                                                                      |
| Paddle — Proposed                      | Billing integration is unbuilt.                                                                                                                                                                                                                        | Confirm launch processor/merchant roles, cancellation, tax/invoice retention, disclosures and terms before billing acceptance.                                                                                                                            |
| First-party browser storage            | Auth config sets an opaque host-only, HttpOnly, SameSite=Lax session cookie, Secure in UAT/production; seven-day rolling session with daily refresh. No direct `localStorage`, `sessionStorage` or `document.cookie` use was found in frontend source. | Capture actual cookies/storage and network requests at sign-in, refresh, sign-out and trailer playback, including library/provider/edge behavior. Record each name, purpose, lifetime and consent classification; a source search is not a browser audit. |

Primary sources checked on 2026-11-07:

- [YouTube embedding documentation](https://support.google.com/youtube/answer/171780?hl=en)
  describes privacy-enhanced mode as limiting personalization, with non-personalized ads possible.
  Engineering inference: this is insufficient evidence for the prototype's blanket banner exemption.
- [Resend security and retention FAQ](https://resend.com/security) reports US storage, email/log
  retention of 30 days on Free/Pro/Scale, seven-day backups, and remaining customer-data deletion
  within 90 days after account termination. These are provider statements, not PickFlick's approved
  policy or evidence of per-User deletion. Review the actual account and
  [DPA](https://resend.com/legal/dpa) before adopting disclosures.
- [GDPR text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679),
  Articles 5, 12, 13, 17 and 20, is an input for the privacy reviewer. Storage limitation, rights
  response, erasure and portability need separate review; it does not approve the prototype's
  blanket 30-day erasure claim. Launch territories and applicability remain unconfirmed.

## Copy conflicts to resolve in #69

| Current source                                                                              | Conflict / required replacement evidence                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings prototype: permanent removal of all personal data within 30 days                   | P1/P9/P10 must cover live data, retained exceptions, email copies and backups before any deadline is published.                             |
| Settings prototype: inactive Clubs archived after 180 days                                  | Roadmap distinguishes Free 90 days and Pro 180 days; implementation still belongs to #74.                                                   |
| Settings prototype: delete all administered Clubs, nominations, ratings and Session history | Contradicts shared-history preservation and adminless Club requirements.                                                                    |
| Settings prototype: no third-party sharing except as required by law                        | Fails to describe provider processing, email, infrastructure and user-initiated YouTube playback.                                           |
| Settings prototype: no cookie consent banner required                                       | Requires jurisdiction-specific review and a browser/provider audit; not established by a first-party session cookie or `nocookie` hostname. |
| Settings prototype: collection/visibility and GDPR-compliant archive assertions             | Reconcile IP/user-agent, Session location/free text, actual Club visibility rules and approved export scope; do not copy universal claims.  |
| Public Privacy/Terms entry source                                                           | Already says provisional; keep that status until #69 has reviewed policy, implementation and public copy evidence.                          |

## External action disposition for owner review

Every identified unresolved action below is proposed as a **Launch gate**, due before Phase 23
release readiness exits and therefore before final UAT. None is proposed for post-launch deferral.
Role owners describe who must act; they do not record acceptance or assign external access.

| Action                                                                                                                   | Accountable owner                                                                 | Required closure evidence                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirm controller/operator identity, launch territories, age/audience scope, privacy contact and applicable obligations | Product owner Alex + legal/privacy reviewer (person unassigned)                   | Written applicability assessment and named reviewer/contact.                                                                                                        |
| Approve P1–P10, exceptions and rights-request procedure                                                                  | Alex + legal/privacy reviewer                                                     | Versioned decisions with all periods, clocks, purposes and exception authority; approval permalink/date. Required before dependent policy-sensitive implementation. |
| Verify processors, agreements, transfers, provider retention/deletion and support mailbox handling                       | Alex + legal/privacy reviewer; infrastructure operator to supply deployment facts | Provider inventory and reviewed agreement/configuration evidence without secrets.                                                                                   |
| Decide cookie/embedded-media consent and verify browser behavior                                                         | Legal/privacy reviewer + frontend owner                                           | Cookie/network capture and explicit consent disposition; required changes tracked before copy approval.                                                             |
| Reconcile backups and restoration with erasure                                                                           | Infrastructure owner (person unassigned) + legal/privacy reviewer                 | #83 approved durability decision and #88 restore evidence preventing erased data from returning to service.                                                         |
| Approve billing/cancellation and financial-record disclosures                                                            | Alex + legal/privacy reviewer                                                     | Phase 20 provider and terms review aligned with P1/P10.                                                                                                             |
| Resolve catalog/media/brand rights and attribution                                                                       | Alex + content/legal reviewer                                                     | #89 rights disposition for launch sources and assets.                                                                                                               |
| Approve final public Privacy/Terms and Settings copy                                                                     | Alex + legal/privacy reviewer                                                     | #69 copy-to-implementation matrix, signed copy version and its required hosted/visual evidence.                                                                     |

If review identifies a noncritical post-launch action, record its named owner, observable due
trigger, linked issue and rationale before reclassifying it. No safety-, privacy- or billing-critical
action may move past final UAT.

## Sign-off and verification

| Approval                                       | State / evidence needed                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Engineering inventory and decision preparation | Source review only, 2026-11-07; no deployed data, accounts or browser cookies inspected.                                             |
| Product policy                                 | Pending Alex's explicit P1–P10 decisions and external-gate disposition. Autonomous engineering authorization is not policy approval. |
| Legal/privacy                                  | Pending named reviewer, launch applicability and approval of the policy version.                                                     |
| Backup/provider feasibility                    | Pending named infrastructure owner and provider/account evidence; #83/#88 remain separate work.                                      |
| Public copy and implementation acceptance      | Pending #65–#69 and applicable release work. Neither this document nor a documentation PR establishes compliance.                    |

Before #64 can meet acceptance, fill every pending decision, record approver/date/permalink for
the exact matrix version, and resolve disagreements. Then reconcile approved policy into the
Roadmap, Architecture, Design, and affected operations references. Do not rewrite accepted ADR
history or mark proposed runtime behavior Active.

Verification for this preparation covers every Prisma model against the inventory, links to source
files, consistency with existing product invariants, formatting and `git diff --check`. Runtime,
UI, provider and legal verification remain the explicitly named gates above. At the Phase 19
boundary, consolidate durable approved policy into canonical documents and remove this working
document and its map link.
