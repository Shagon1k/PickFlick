# Phase 17 — Notifications and preferences

This phase implements [Roadmap Phase 17](../ROADMAP.md#phase-17--notifications--preferences--in-progress).
Project 3 owns live status: [#60](https://github.com/Shagon1k/PickFlick/issues/60) covers persistence,
preferences and safe event mapping; [#61](https://github.com/Shagon1k/PickFlick/issues/61) owns inbox,
bell, read-state APIs and SSE; #62 owns Resend
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

## Issue 61 implementation and remaining gates

Run `r_e0670d883186bbcfc808` uses managed branch `PF-61_17-2-build-inbox-bell-read` in the
launcher-provided worktree. The worktree started clean; #60 is closed and Project 3 confirmed
#61 In progress at admission. No manual worktree is created.

Reuse the existing Notification rows, safe projection, product overlay, design tokens and Icon
component. The recipient-scoped inbox returns stable descending pagination and unread count in
one repeatable-read transaction. Read mutations filter recipient and in-app availability and
preserve the first timestamp. Suppressed notifications and foreign cursors never enter the list.
The SSE route rechecks the original session before emitting refresh-only signals every five
seconds. Nest supplies the streaming headers and disconnect cleanup. The shell reads REST on
initial load, stream connection/messages, reconnect and focus, plus periodic reconciliation;
overlapping refreshes coalesce and loaded pages remain available. Entity/file routes keep their
existing authorization. There is no migration, environment variable, provider call or new dependency.

This is a partial delivery. Redis distribution requires a new client; AGENTS.md requires explicit
dependency approval, which was requested during this run and remains pending. Do not describe
periodic SSE reconciliation as Redis distribution or claim multi-instance broker verification.
The proposed integration is the official Node Redis client with separate publisher/subscriber
connections and recipient-only refresh signals; PostgreSQL remains authoritative after gaps.
The repository has no hosted-preview workflow or configured preview destination. Exact-head
hosting and owner acknowledgment are also pending. Keep the issue open and the PR Draft.

### Issue 61 local verification

Use Node 24.15.0, pnpm 11.25.0 and the launcher's workspace store. Prisma's home cache is read-only;
an isolated `/tmp/pf61-cache` resolves installation without modifying credentials. A new disposable
`pf61-postgres` container hosts only `pickflick_test` on loopback port 43461. All 34 existing
migrations apply, and the synthetic seed succeeds. Existing services remain untouched.

Rendered reference inspection uses `app.html` at 390 and 1440px, with the design contract,
responsive baseline and Settings notification markup. The implementation keeps the existing
344px panel, neutral surface, bounded list, small unread dots and mobile placement above Alerts.
Linked bodies include their metadata in one 44px target to preserve row density. The header's
read action has a 44px target. The app panel's refined shared composition takes precedence over
the older Settings fixture styling; neither prototype is rewritten.

Six focused browser checks pass in the digest-pinned Playwright image: desktop/mobile read state,
pagination, focus, dismissal, axe and overflow; two-tab synchronization; offline gap recovery;
empty state; loading, load/save failures and retry. The first run exposed a mock-only buffering
problem: its SSE headers omitted Nest's automatic no-transform header. Aligning the mock fixes
immediate frontend-proxy delivery. A direct proxy check receives the refresh event immediately.
The first desktop outside-click assertion targeted content under the popover; it now uses the
non-interactive header background and checks that the route stays unchanged. Three stream unit tests pass, including revocation of an already
open stream. The first full integration run lacked synthetic seed fixtures and compared the
entire Nest-owned cache header too strictly; seed setup and token assertions correct those checks.

After seeding, the complete integration suite passes 293 tests across 37 files, including all five
inbox cases and the real authenticated SSE response/header check. No existing integration test is
skipped or changed. All three stream unit tests pass, including authorization loss after opening.

`pnpm verify` passes the production dependency audit gate, lint, Knip, formatting, type checking,
all 521 unit tests across 58 files and all workspace builds. The production audit reports two low
and five moderate findings, with no high/critical finding. Final focused verification after raising
the inbox polling allowance for shared client addresses passes all five inbox integration cases.
The staged gitleaks scan passes with a checksum-verified release binary and no allowlist change.
The disposable database container is removed after verification. No UAT/production deployment,
Redis distribution or actual email delivery is claimed.

The final notification browser selection passes eight cases against the verified production build.
It also proves that session expiry clears cached rows/links and that a lost browser action request
releases pending state, preserves retry feedback and succeeds on retry.

The full selected UI smoke suite passes all 93 checks. New 390/1440 populated panel baselines
were generated in the digest-pinned Playwright image and inspected against the rendered canonical
popovers; the existing baselines and zero-pixel tolerance remain unchanged. Final keyboard review
moves focus to the stable panel before read/pagination controls become disabled or disappear.
The notification checks explicitly assert retained focus and outside dismissal without navigation.

After that focus correction, the frontend production build/type check and all eight focused browser
checks pass again. Keyboard read actions and completed pagination retain panel focus at both
widths; outside dismissal keeps the current route. The change uses the existing panel ref rather
than adding a focus-management mechanism.

The final full UI visual selection passes all 106 checks in the pinned Linux image, including the
two new notification captures. All 108 screenshot files use the existing zero-pixel tolerance.
The remaining issue gates are Redis distribution and an exact-head hosted preview with owner
acknowledgment; local tests and captures do not satisfy those gates.
