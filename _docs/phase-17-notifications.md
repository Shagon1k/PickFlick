# Phase 17 — Notifications and preferences

This phase implements [Roadmap Phase 17](../ROADMAP.md#phase-17--notifications--preferences--in-progress).
Project 3 owns live status: [#60](https://github.com/Shagon1k/PickFlick/issues/60) covers persistence,
preferences and safe event mapping; #61 owns inbox, bell, read-state APIs and SSE; #62 owns Resend
templates, retry/backoff, suppression and delivery observability.

Run `r_d19661da0f0f02cfaf82` uses managed branch
`PF-60_17-1-establish-durable-notifications-preferences`. Dependencies #12, #35, #51 and #59 are closed.

## Issue 60 implementation

Reuse Prisma transactions, Session phase/progress versions, Club audit rows and newly earned
AchievementAward rows. Migration 34 adds Notification, NotificationPreference and
NotificationDeliveryAttempt without backfilling old activity or replacing existing deadline intent.
There is no new dependency, worker, provider call, environment variable or frontend change.

The Notification key is `(recipientId, event, sourceId, occurrence)`. Source IDs are internal UUIDs;
Session occurrence is its phase version, or deadline version for an empty Nomination deadline.
Audit and award occurrences use one. Database conflict handling preserves the first preference
snapshot and its two channel records across retries, including concurrent transactions.
Notification failure rolls back the source change. Only active accounts receive new intent.

Stored content is restricted to event enums, source/entity UUIDs, versions, channel flags and
read/delivery timestamps. No generic JSON, copied titles, member names, rating values, comments,
addresses, invitation tokens/URLs, email bodies or provider errors are accepted. Entity references
have no foreign keys, so deletion retains the logical update; projection checks current entity
existence and access before returning static copy and a canonical relative link. Missing/private
targets return the same generic message and no link. Recipient identity is checked first.

## Event and preference policy

All optional events default to in-app enabled and email disabled. Prototype checkbox examples are
fixtures; they do not constitute consent. Explicit per-event preferences override these defaults.
`BILLING_SERVICE` is the sole mandatory exception: both channels remain enabled and attempts to
disable either return `MANDATORY_NOTIFICATION`. This event is reserved for transactional billing
service notices, never marketing. Paddle producers remain Phase 20 work. Inactivity detection
remains with the later Club lifecycle work; its event type and preference can be stored now.

| Event                                                                              | Source and audience                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SESSION_STARTED                                                                    | Live Session creation; current active Club members. PAST imports produce no start alert.                                                                     |
| SELECTION_OPENED                                                                   | Entry into Selection; accepted participants with active Membership.                                                                                          |
| SELECTION_CLOSED                                                                   | Movie chosen, including single-nomination advance; accepted active members.                                                                                  |
| RATING_OPENED / RATING_CLOSED                                                      | Entry into Rating / Completed; accepted active members.                                                                                                      |
| SESSION_CANCELLED                                                                  | Cancellation; accepted active members.                                                                                                                       |
| NOMINATION_STALLED                                                                 | Empty deadline decision; current Admins and Moderators.                                                                                                      |
| MEMBERSHIP_JOINED / MEMBERSHIP_ROLE_CHANGED / MEMBERSHIP_REMOVED / MEMBERSHIP_LEFT | Actual audited change; affected User. Admin transfer also alerts the former Admin. Departed Users see only generic unavailable copy.                         |
| CLUB_ARCHIVED / CLUB_REACTIVATED                                                   | Actual audited lifecycle change; active members.                                                                                                             |
| ACHIEVEMENT_EARNED                                                                 | Newly inserted award; personal owner, or active Club members. Private Club awards target Admins/Moderators only; projection rechecks the saved privacy flag. |
| CLUB_INACTIVITY_WARNING                                                            | Reserved for the inactivity producer; Club reference required.                                                                                               |
| BILLING_SERVICE                                                                    | Reserved for billing; recipient account only, no billing/customer data stored.                                                                               |

Authenticated `GET /notifications/preferences` returns the full effective matrix; `PUT` accepts one
strict `{ event, inApp, email }` row. Neither accepts a User selector or extra query parameters.
Responses are private/no-store. Changes affect future events, not already committed intent.

Each new logical update gets attempt one for both channels. In-app is DELIVERED or SUPPRESSED;
email is PENDING or SUPPRESSED. DELIVERED here means the durable in-app row is available, not that
it has been read. #62 must recheck current authorization, account status and suppression before
sending and use the Notification UUID as the provider idempotency key. No dispatcher or retry
implementation is introduced by #60. #61 must use the safe projection and filter inApp when listing.

## Verification plan

Run the complete pure event/channel matrix, strict API ownership/validation checks, real PostgreSQL
concurrent duplicate and distinct-recipient/version tests, preference snapshot tests, source
transaction rollback, and payload/projection checks after departure, deletion and role downgrade.
Validate the additive migration on a new isolated loopback `pickflick_test` database, then run the
full integration suite and `pnpm verify`. Existing services and credential files remain untouched.
No UI changed, so no new screenshot baseline or visual acceptance is required for #60. The shared
contract changes still select the complete smoke and visual regression suites under the CI rules.

## Issue 60 verification

Node 24.15.0 and pnpm 11.25.0 use the launcher's workspace store. A new disposable PostgreSQL
container serves only `pickflick_test` on loopback port 43432. All 34 migrations apply cleanly and
the synthetic seed succeeds. Existing services and credential files are unchanged.

The full integration suite passes 287 tests across 36 files. After adding the concurrent real-API
personal-achievement/foreign-award check and strengthening rollback assertions, all seven focused
notification integration tests pass. They cover strict authenticated preference APIs, User
isolation, mandatory billing constraints, concurrent deduplication, first preference snapshots,
separate recipients/occurrences, channel attempts, atomic source rollback, Session source mapping,
Membership departure, deleted Sessions/Clubs/awards, private-award role downgrades and foreign
award ownership. Payload review confirms there is no generic JSON or copied entity content.
The first focused run failed only because the deleted-Club fixture omitted its required ARCHIVED
lifecycle; the corrected fixture passes.

`pnpm verify` passes the production audit gate, lint, Knip, formatting, type checking, all 518 unit
tests and all workspace builds. Eighty pure cases cover defaults and every optional flag
combination for all sixteen events. The audit has two low and five moderate findings. The final
integration-test expansion also passes focused backend type checking and ESLint.

The complete UI selections pass: 91 smoke tests and 104 exact visual comparisons in the
digest-pinned CI Playwright image with Node 24.15.0, using an isolated container network. No
baseline changes or pixel-tolerance changes are made. The staged gitleaks scan passes without
an allowlist change. No UAT/production migration or actual email delivery is claimed.

## Review fix round 1

The deduplication test now establishes its own preference snapshot before concurrent writes. It
passes alone and with all seven notification integration tests against a disposable local
`pickflick_test` database. Recipient selection and transactional recording live in
`notification-producers.ts`; authorization-aware projection lives in `notification-resolver.ts`.
The Session producer names its audience condition and reuses it for the occurrence version.
The store comment clarifies that in-app DELIVERED means durable inbox availability, with client
push and `readAt` separate. These changes preserve notification behavior and delivery policy.

The full integration suite passes 288 tests across 36 files. The disposable database container
is removed after verification. `pnpm verify` passes the production audit gate, lint, Knip,
formatting, type checking, all 518 unit tests and all workspace builds. The first lint run caught
an import ordering change from the resolver rename; sorting that block fixes it. The staged
gitleaks scan passes. This backend-only review round does not rerun the UI suites.
