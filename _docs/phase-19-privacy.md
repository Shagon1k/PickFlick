# Phase 19 — Privacy policy preparation

Decision evidence for [#64](https://github.com/Shagon1k/PickFlick/issues/64), recorded 2026-11-09.
Project 3 owns live issue status. This document supports review; it does not approve legal copy or claim compliance.
The owner separately authorized #65 on 2026-11-10, keeping legal/privacy decisions gated. Keep it while Phase 19 is active, then
consolidate durable decisions into the canonical documents.

## Scope and approval record

Reuse the existing data model, shared-history rule and public legal entry points. This change
records policy inputs and remaining decisions. Runtime deletion, export, retention jobs, billing,
public copy, production setup and provider account changes belong to their existing issues.

The owner decisions below come from the bounded predecessor conversation supplied with this run
(thread `01a1b378-3511-7681-9ee0-c4624de8203a`, messages in source order). Later assistant suggestions
are not approvals. The continuation authorizes documentation delivery, not product/legal sign-off.

| Evidence                                                                           | Decision or limitation                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner: “Неактивность - поменяй на 180 и 360, удлиним”                              | Free Club inactivity grace becomes 180 days; Pro becomes 360 days. Archiving preserves data and allows reactivation.                                                                                                                                                                                                                                                                                                    |
| Owner: “что предложил, кроме неактивности”                                         | Accepts the earlier proposal: re-authentication and explicit deletion confirmation; immediate session revocation and blocked login; background cleanup with a 24-hour technical target; anonymized shared history; personal CSV and full archive; archive availability 7 days; technical logs 30 days; audit 90 days; backups 30 days; stop future subscription charges with separately justified financial exceptions. |
| Owner: “Литва”, then “Да, США”                                                     | Operator location is Lithuania; intended audience includes Europe and the US. The owner reconfirmed Europe + the US on 2026-11-10; country-specific review remains open.                                                                                                                                                                                                                                                |
| No owner acceptance of the later 18+ suggestion or external-action recommendations | The owner accepted 16+ on 2026-11-10. Final operator identity/form, reviewer, detailed exceptions and final policy disposition remain open. Do not silently restrict the intended launch to Europe alone.                                                                                                                                                                                                               |

The accepted periods are product decisions. They are not a legal determination that those periods
suit every purpose. The legal/privacy reviewer is **unassigned**. Alex owns obtaining the remaining
decisions and assigning that reviewer; no business registration or external consultation is claimed.

## Data inventory

Evidence: [Prisma schema](../packages/database/prisma/schema.prisma),
[Architecture](../ARCHITECTURE.md#3-data), [authentication](authentication.md),
[security](security.md) and [email operations](email-delivery.md).
No live personal data or credentials were inspected.

| Category and current storage                                                                               | Purpose/access and deletion/export review                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`, `ProviderAccount`                                                                                  | Identity, email, name, avatar source, locale, roles/status and provider subject. Remove identifying fields and provider links; prevent login. Export own profile/provider information without credentials. Auth hooks clear provider tokens before persistence despite token columns existing. A retained history reference is not proof of anonymization. |
| `AuthSession`, `AuthVerification`, `AuthRateLimit`                                                         | Sign-in, expiring state, session IP/user agent and abuse counters. Revoke all sessions immediately; define private/expired-state cleanup. Never export session tokens, OAuth state or security secrets.                                                                                                                                                    |
| `Club`, `Membership`, `ClubInvite`                                                                         | Shared Club content, historical roles and invite digests/recipient links; membership-scoped access. End active membership, preserve anonymized history and inspect inviter/target/responder references. No peer identities or invitation secrets in archives.                                                                                              |
| `Session`, `SessionParticipant`                                                                            | Schedule, location, topic, notes, roster and attendance; current Club access. Preserve shared screenings; review free text and participant references. Export the requester's contributions with only necessary context.                                                                                                                                   |
| `Nomination`, `SelectionBallot`, `SelectionScore`, `PastNomination`, `PastSelectionScore`, `SessionRating` | Shared nominations, immutable ballots, imported evidence and scores/comments. Preserve anonymized shared results; review identifying comments and imported nominator links. Own contributions remain separate from peers' private scores.                                                                                                                  |
| `Session.selectionResult`                                                                                  | Frozen JSON results with participant/nominator references. Inspect every field; replacing the current display name does not sanitize snapshots. No blanket snapshot export.                                                                                                                                                                                |
| `NominationDeadlineDecision`, `SessionProgressEvent`                                                       | Idempotent decisions, phase evidence and achievement inputs. Classify domain history separately from logs/audit; review `recipientIds`. Do not erase achievement inputs merely because the audit default is 90 days.                                                                                                                                       |
| `PersonalMovieRating`, `WatchlistItem`                                                                     | Private Library and Watchlist. Include own data in the appropriate export; remove on account deletion. Historical `SessionRating` remains a separate shared record.                                                                                                                                                                                        |
| `AchievementAward`                                                                                         | Personal/Club award evidence and JSON snapshots. Delete private awards; review copied identifiers/explanations before retaining Club evidence.                                                                                                                                                                                                             |
| `Notification`, `NotificationPreference`, `NotificationEmailDelivery`                                      | Recipient-only inbox/preferences, pending mail, address hashes and provider IDs. Remove deleted-account private rows/deliveries; assess references in other recipients' notifications. No peer data in exports.                                                                                                                                            |
| `NotificationEmailSuppression`, `NotificationEmailWebhook`                                                 | Address hashes prevent unwanted mail; receipt IDs prevent replay. No User foreign key: explicitly decide purpose, lifetime and deletion exceptions. Hashing alone does not settle privacy obligations.                                                                                                                                                     |
| Private object storage                                                                                     | Club/personal avatars and catalog images/thumbnail cache; exports remain planned. Remove private User files/export artifacts; inspect identifying shared avatars. Separate live shared media from abandoned objects.                                                                                                                                       |
| `Movie`, `MovieExternalId`, `MovieDetailsCache`, `MovieSearchCache`                                        | Shared catalog and JSON search caches. Preserve catalog data; review search/cache payloads and provider requests for personal information. Cache expiry/media licensing are separate from account deletion.                                                                                                                                                |
| Contact mail, Resend, Google Workspace                                                                     | Contact sends name/email/message through email, without a Contact DB row. Cover mailbox/provider copies, support correspondence and rights requests; periods are unresolved. The technical-log period does not cover mail bodies.                                                                                                                          |
| Application/edge logs, monitoring, CI artifacts                                                            | Operations/security. App logging redacts sensitive headers and omits request URLs/bodies. Define edge/provider/telemetry retention separately; CI currently retains uploaded artifacts for 14 days. Inspect captures for personal data.                                                                                                                    |
| Backups and future billing/export records                                                                  | Recovery, subscriptions/financial obligations and portability jobs. Cover DB/object copies, provider records and restore. Billing/export models are planned; financial and job-metadata periods remain open.                                                                                                                                               |

`ClubAuditEvent` also retains actor/subject User and Membership references under restrictive foreign
keys. Its sensitive-action evidence needs the approved audit retention schedule and a deletion
strategy for those identifiers. Export only the requester's disclosable data after excluding peer
identities; do not assume deleting the User row can cascade through shared audit/history.

## Retention and behavior decision matrix

**Product accepted** refers to the owner's decision above. Clock origins and operational details
below are **proposals for review**. **Open** requires a decision; no missing value approves
indefinite retention.

| Policy                         | Product decision                                                                                        | Proposed detail or open question                                                                                                                                                                                                                 | Delivery/evidence                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Deletion access                | Re-authenticate, explicitly confirm, revoke sessions and block login immediately                        | Define the durable acceptance point; repeat requests must converge without duplicate effects.                                                                                                                                                    | #68                               |
| Private cleanup                | Within 24 hours is a technical target                                                                   | Measure from accepted confirmation; cover DB, objects, pending mail and provider links. Failures need visible operator status. Do not publish an unconditional guarantee before evidence.                                                        | #68, #87                          |
| Shared history                 | Preserve Club/Session history with anonymized attribution; notify members if the Club becomes adminless | Review snapshots, free text and indirect identifiers. Decide residual linkability, comment handling and exceptions; a “Deleted user” label alone is insufficient. Ownership recovery stays out of scope.                                         | #68                               |
| Personal CSV                   | Own Personal Ratings, separate from full archive                                                        | Confirm exact fields and formula-injection handling in #66. Direct downloads need no seven-day server copy unless an artifact is persisted.                                                                                                      | #66                               |
| Full archive                   | Own data and manifest; private availability for 7 days                                                  | Start at successful generation; deny expired downloads and remove artifacts. Deletion also invalidates access. Confirm job metadata, partial/failed artifacts and backup treatment; downloads do not restart expiry.                             | #67, #87                          |
| Technical logs                 | 30 days                                                                                                 | Start at event time; define application, worker, edge and telemetry coverage and deletion cadence. Minimize content when collected.                                                                                                              | #87, release observability work   |
| Audit                          | 90 days                                                                                                 | Start at event time; classify Club audit, future App Admin/billing audit and deletion evidence. Confirm statutory exceptions and configuration limits. Domain history is not automatically an audit log.                                         | #78, #87                          |
| Inactive Clubs                 | Archive Free after 180 days, Pro after 360 days; Admin notice, no automatic deletion, reactivation      | Define qualifying activity, warning timing and plan changes in #74. These are archive thresholds, not erasure periods.                                                                                                                           | #74                               |
| Inactive personal accounts     | Archive only, using the same 180/360-day Free/Pro thresholds; no automatic deletion                     | Owner decision on 2026-11-10: apply the same inactivity approach to personal accounts, archive rather than erase. Activity signals, warnings, exemptions, reactivation and implementation remain future work; requested deletion stays separate. | Alex + reviewer, #64              |
| Backups                        | 30 days                                                                                                 | Proposed rolling maximum from snapshot creation for DB/objects. Approve versioned-object expiry and provider copies. Isolate restores until deletions are reapplied/verified; choose a minimal deletion record with a justified lifetime.        | #83, #88, #68                     |
| Financial records and holds    | Stop future charges; retain separately justified exceptions                                             | Decide exact records, basis, period/clock, access, provider responsibilities and disclosures. No blanket hold or invented accounting period. Billing failure must not silently reactivate an account.                                            | Alex + reviewer, Phase 20, #68    |
| Other private/operational data | Open                                                                                                    | Set purpose-specific periods for support/privacy mail, notifications, suppression hashes, webhook receipts, auth cleanup, export job metadata and abandoned uploads; define deletion overrides.                                                  | Alex + reviewer, #64; cleanup #87 |

## Providers, cookies and public copy

This is a source review, not a deployed browser or contractual audit. Alex and the privacy reviewer
must confirm provider legal entities, roles, regions, subprocessors, terms/DPA as applicable,
retention and transfer bases before final UAT. EU hosting alone does not establish that support
access and onward transfers stay in the EEA.

| Provider/surface                                   | Evidence and review needed                                                                                                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting, Dokploy, PostgreSQL, MinIO/S3, Cloudflare | UAT topology exists; production provisioning is separate. Inventory hosting operator, storage/backup regions, traffic metadata, edge cookies/logs and admin access. Production S3 is expected, not provisioned.        |
| Google OAuth; dormant Apple                        | Google receives sign-in requests and returns subject/email/profile. Apple stays gated. Confirm enabled providers and applicable terms; disclose actual sharing.                                                        |
| Resend and Google Workspace                        | Recipients and notification/contact content leave the app. Confirm mailbox retention, provider events/suppression and rights handling. Public contact is `hello@pick-flick.app`; test the privacy-request workflow.    |
| PoiskKino, TheTVDB, TMDB and media hosts           | Configured server-side catalog queries/image fetches disclose queries/media IDs and server network metadata. Images/thumbnails reach browsers through PickFlick. Check contractual rights and provider logs.           |
| YouTube and outbound links                         | `youtube-nocookie.com` loads after Play. This network restriction is not legal consent evidence. Review disclosure and required consent before connection; inspect player storage. Other links open external services. |
| Paddle                                             | Proposed billing. Verify merchant/provider roles, checkout storage, financial retention, cancellation and terms before enabling. No paid launch is approved here.                                                      |
| Monitoring, analytics and marketing                | Inventory future telemetry before use. No advertising trackers or marketing cookies are approved; each future integration needs a separate review.                                                                     |

Source defines the secure `__Host-pickflick.session_token` (local: `pickflick.session_token`) with
seven-day sessions and one-day renewal, plus the session cookie `pickflick.last_club` without a
persistent expiry for routing. OAuth uses DB state; inspect library transient cookies and deployed
edge cookies too. See [`auth.config.ts`](../apps/backend/src/modules/auth/auth.config.ts),
[`last-club.ts`](../apps/frontend/src/lib/last-club.ts), and [CSP](security.md#response-headers).
Do not infer a consent exemption for every cookie, preference or embed from its name or CSP.

Public legal routes identify themselves as provisional. Keep that status until #69 publishes
reviewed, implementation-backed text. Known copy work:

- Pricing content and `pricing.html` still say 90/180 days. The Roadmap's approved 180/360 overrides
  those fixtures; reconcile displayed copy in #69/#74 and verify rendered pages.
- Settings prototype deletion periods and “no cookie banner” claims are unapproved. Explain
  immediate access revocation, tested cleanup timing, backup ageing, shared history, financial
  exceptions and archive expiry consistently in Settings and the Privacy Notice.
- The final notice needs controller identity/contact, purposes/bases, recipients/transfers,
  retention periods/criteria, rights/request route and applicable complaint information. Terms
  must match the chosen audience, age policy and billing. This document is not that notice.

## External actions and sign-off

This disposition is proposed for owner review. Every safety-, privacy- or billing-critical item
is a **Launch gate before final UAT**, and earlier when the activity requires it. No entry claims
a completed external action or legal approval.

| Action                                            | Classification and accountable owner                                          | Evidence needed                                                                                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller and markets                            | Launch gate — Alex                                                            | Confirm natural-person/entity identity, publication details/contact and Europe/US coverage; assign reviewer. Do not infer identity from GitHub.                                                                         |
| Lithuanian commercial activity                    | Launch gate — Alex with VMI/accountant                                        | Confirm suitable form, registration timing and accounting/tax obligations before relevant activity. First payment is not assumed to be the only trigger. No physical VMI visit or company formation is prescribed here. |
| Age policy                                        | Launch gate — Alex + reviewer; before dependent age-related implementation    | 18+ remains proposed. Decide audience, age handling and discovered-minor response; a label alone is insufficient.                                                                                                       |
| Retention and exceptions                          | Launch gate — Alex + reviewer; #64 checkpoint before dependent implementation | Approve clock origins, missing categories, shared-history handling, financial/hold exceptions and backup alignment. Record reviewer, date, disposition and evidence.                                                    |
| Providers, transfers, cookies/embeds              | Launch gate — Alex + reviewer                                                 | Complete provider/contracts/transfer review; capture deployed storage/network behavior before/after login, before/after Play and at enabled checkout.                                                                   |
| Privacy Notice and Terms                          | Launch gate — Alex + reviewer                                                 | Review Lithuania/Europe/US applicability and actual behavior; approve the exact copy revision. US review is not an approved post-launch deferral.                                                                       |
| Rights requests and incidents                     | Launch gate — Alex                                                            | Tested inbox ownership, identity checks, response/escalation procedure and applicable deadlines; manual handling can support launch. Define request/incident evidence retention.                                        |
| Deletion, portability, retention and restore      | Launch gate — engineering evidence reviewed by Alex                           | Own-data isolation, anonymization review, expiry/failure checks, billing cancellation and restore without account reactivation. #83/#88 also approve recovery objectives and drill evidence.                            |
| Paid-service obligations                          | Launch gate — Alex + reviewer                                                 | Approve renewal, cancellation/refunds, disclosures, financial records and provider responsibilities before paid service. Paddle does not waive review.                                                                  |
| Privacy-request automation                        | Proposed post-launch follow-up — Alex                                         | Only automation is deferred; manual handling must work at launch. Revisit 30 days after launch, subject to owner acceptance.                                                                                            |
| Marketing integrations or extra markets/languages | Proposed post-launch follow-up — Alex                                         | Review before enabling each addition; consent, sharing and copy first. These additions stay outside the launch baseline.                                                                                                |

Authoritative starting points checked for preparation, not legal sign-off:
[Irish DPC on purpose-specific retention](https://dataprotection.ie/en/faqs/responsibilities-data-controllers/how-long-should-personal-data-be-held-meet-obligations-imposed-gdpr),
[EDPB on transfers and processor contracts](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en),
[Your Europe on cookies](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm),
[California DOJ on privacy policies](https://www.oag.ca.gov/privacy/facts/online-privacy/privacy-policy),
and [VMI's online registration service](https://www.vmi.lt/evmi/individualios-veiklos-pagal-pazyma-uzsakymas-keitimas).

## Review and verification record

- Product numbers and Lithuania/US intent: owner-backed by the predecessor messages above.
- Prepared details, external-action disposition and package acceptance: **pending Alex**.
- Legal/privacy approval, reviewer identity and date: **pending**. None recorded.
- Implementation-backed copy, browser/provider audit, cleanup tests and restore drill: **pending
  linked delivery work**. No runtime or UI change is included here.
- Preparation checks (2026-11-09): all 31 Prisma models covered; all 14 new local link targets
  exist; accepted-period and pending-approval checks passed. Prettier passed for all six changed
  Markdown files under Node 24.15.0 / pnpm 11.25.0; `git diff --check` passed. Runtime/UI tests
  were not run for this documentation-only change.

#64 cannot meet its approval criteria until the owner and reviewer resolve the open decisions.
Do not close it or clear dependency checkpoints on the strength of this preparation PR.

## Owner continuation, 2026-11-10

The bounded handoff from thread `01a1c4f5-90f1-7012-9319-a947d32cc85a` contains these later
owner decisions, in source order:

- “Proceed with #65. Keep unresolved legal/privacy decisions gated separately.” This clears the
  dependent implementation checkpoint for #65 only.
- Europe + the US remains the intended market.
- “Давай с аккаунтами тоже самое, но их только архивируем - не удаляем”: inactive personal
  accounts follow the same 180/360-day archive approach; automatic erasure is excluded.
- “16+ - ок”: the minimum product age is 16. Country-specific legal review is still required.

Lithuanian individual activity was discussed as an operator option, but no owner selection,
registration, tax review or legal sign-off was evidenced. Provider/cookie review, final public
copy, financial exceptions and tested deletion/backup behavior remain open. No inactive-account
archiving or age-enforcement behavior is added by #65.
