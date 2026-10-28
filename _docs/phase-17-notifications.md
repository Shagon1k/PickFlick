# Phase 17 — Notifications and preferences

This phase implements [Roadmap Phase 17](../ROADMAP.md#phase-17--notifications--preferences--in-progress).
Project 3 owns live status: [#60](https://github.com/Shagon1k/PickFlick/issues/60) covers persistence,
preferences and safe event mapping; [#61](https://github.com/Shagon1k/PickFlick/issues/61) owns inbox,
bell, read-state APIs and SSE; #62 owns Resend
templates, retry/backoff, suppression and delivery observability.

Run `r_d19661da0f0f02cfaf82` uses managed branch
`PF-60_17-1-establish-durable-notifications-preferences`. Dependencies #12, #35, #51 and #59 are closed.

## Issue 62 email delivery

The owner approved PostgreSQL dispatch, bounded retries, the **Card** composition for all sixteen
events, `PickFlick UAT <uat@pick-flick.app>` and the synthetic recipient `test@pick-flick.app`.
Operator alerts use `CONTACT_DELIVERY_TO`: `test@pick-flick.app` in UAT and `hello@pick-flick.app`
in production. These decisions precede the predecessor's incomplete summary; neither visual
selection nor the alert destination is an outstanding implementation question.

The same managed branch `PF-62_17-3-deliver-resend-email-templates` preserves sender preparation
commit `421272e`. [ADR-020](decisions/README.md#adr-020--dispatch-notification-email-from-postgresql)
records the approved queue boundary before implementation. The dispatcher reuses Notification
intent, delivery attempts, current authorization projection and the backend polling lifecycle.
No BullMQ, new dependency, Web Push, inactivity producer or billing producer is added.

Migration 35 creates one email delivery per opted-in Notification, address-hash suppression and
webhook receipt records. It also queues previously pending email intent. Source transactions
create new jobs atomically. Each claim also materializes pending intent from old API instances
that can still write during a rolling migration. Workers claim one due row using `SKIP LOCKED`, a two-minute lease and a
fencing token. Expired claims recover after restart. Six attempts use 1-minute, 5-minute,
30-minute, 2-hour and 6-hour backoff, within 23 hours from the first claim. The stable provider key
and request hash prevent changed retries; expired or changed requests fail for operator review.
Provider acceptance and confirmed delivery are distinct. Preference edits apply to future events;
current user/entity authorization and address suppression are checked immediately before sending.

Templates contain static copy, current authorized links and a generic unavailable state; no Club
names, Movie titles, scores, participant names or invitation tokens. Inline email styles and tables
implement the selected composition. Mandatory notices offer no opt-out action. Local/test/preview
workers leave queue state untouched. `pnpm email:preview` generates the same templates as HTML and
plain text, with the checked-out revision and an explicit dirty marker when applicable.

`POST /api/webhooks/resend` verifies the exact raw body using the installed Resend SDK, then parses
its supported fields through contracts. Persisted receipt IDs deduplicate replays. Provider IDs or
signed notification tags plus recipient hashes correlate callbacks, including a callback racing
the send response. Bounce, complaint and provider suppression block later mail to that address,
including mandatory notices. Terminal rejection cannot regress to delivered or accepted.

Final failures and provider suppression events cause one persisted, best-effort operator alert.
Alert failure is logged without recursion. Database states, delivery attempts and structured events
provide operational counts; [Email delivery operations](email-delivery.md) documents queries,
configuration, preview generation, recovery limits and remaining provider checks.

### Verification in this continuation

Node 24.15.0 and pnpm 11.25.0 are used. Migration 35 applies successfully to an isolated local test
database. The focused unit selection passes 53 checks; notification integration passes 34 checks,
including eleven dispatcher and eight signed-webhook cases. This proves competing claims, expiry
recovery, stale-result fencing, bounded retries, stable payloads, preference/mandatory behavior,
revoked access, replay rejection, early callbacks and suppression of later mail. No live mail is sent. `pnpm verify` passes the production security gate, repository lint, unused-code
analysis, formatting, all workspace/root type checks, 556 unit tests and production builds.
`pnpm deploy:check` passes. The full seeded integration suite passes all 315 tests in 40 files. A built-process smoke proves disabled delivery, heartbeat creation and
graceful SIGTERM. This does not exercise a live Resend key.

The generated catalog passes 96 event/state/width checks at 320, 390 and 1440px without overflow or
email JavaScript errors. Representative available, unavailable and mandatory layouts are inspected;
app.html and settings.html references are rendered and inspected at 390/1440 after fonts, images and
finite animations settle. Comparison preserves noir surfaces, serif hierarchy, restrained amber,
neutral actions and the selected Card composition. Standard email font fallbacks replace web fonts;
no image or copied prototype script is used. Browser checks do not prove Gmail, Apple Mail or
Outlook rendering. No application screen or UI baseline changes.

The full pinned Playwright smoke/visual selection records 201 passes and one flaky Nomination
check (`nominations.spec.ts:129`, two-client offline phase recovery). It times out once and passes
on retry; CI's fail-on-flaky policy therefore rejects the run. A focused three-repeat run with no
retries records two passes and one timeout during browser-context cleanup. No application frontend
code or baseline changes are introduced by #62. The selected UI gate remains unresolved; the
failure artifacts are retained under `test-results/pf62-focused-ui-artifacts`.

Real Resend sandbox delivery, deployed signing-secret/provider configuration, exact-head hosted
preview and final owner visual acknowledgement remain open acceptance gates. This work does not
deploy, merge, alter provider settings or mark the issue/phase Done.

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

## Issue 61 initial implementation and remaining gates

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

At initial submission this was a partial delivery. Redis client approval was pending; the owner
subsequently approved the integration recorded in review fix round 2 below. Do not describe
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
At initial submission, the remaining issue gates were Redis distribution and an exact-head hosted
preview with owner acknowledgment; local tests and captures do not satisfy those gates.

## Issue 61 review fix round 2

The owner approved the official Node Redis client and focused configuration and Compose changes
in PR #197. ADR-019 records recipient-only invalidation, post-commit publication and best-effort
recovery. A concrete notification transaction service collects newly inserted in-app recipients
and publishes after commit. Club, Session, achievement and deadline-worker producers use it.
Read mutations publish after successful updates. No schema, migration, backfill, generic event
framework, queue, outbox, cache, credential or permission change is introduced.

Each API subscribes once and routes recipient-only signals to every matching local SSE connection.
REST still authorizes and projects all content. Node Redis restores subscriptions after reconnect.
Offline publishes are skipped; a 500ms reply bound prevents a stalled broker from delaying a
successful business action. Errors omit broker details. Thirty-second named heartbeats reauthorize
streams without requesting REST. Initial connection, reconnect, focus and five-minute reconciliation
recover persisted state. A signal during an active refresh schedules one coalesced follow-up.

Notification links close the overlay within the persistent Club frame. Reverse Tab from the
focused panel wraps to its last control after read actions. The existing overlay and panel refs
own these behaviors. Existing visuals and entity authorization remain unchanged.

### Round 2 verification

The focused stream/configuration selection passes 24 unit tests. Three Redis integration cases
pass against new disposable loopback PostgreSQL (`pickflick_test`, port 43461) and Redis (46379).
They cover cross-instance recipient isolation, multiple SSE connections, read synchronization,
commit ordering, rollback, duplicate intent, stalled publication and subscription restoration.
An initial test-helper omission was corrected. The outage test exposed that the Redis client's
command timeout ends when bytes are written; an explicit reply deadline fixes that failure.

`pnpm verify` reaches the production audit and fails on the unchanged `better-auth@1.7.5` dependency:
one critical and one high advisory, plus four low and six moderate findings. Auth dependency
updates are outside this bounded review scope. The remaining gates run individually; results are
recorded below. Hosted exact-head preview and owner visual acknowledgment remain pending. No shared-environment deployment is authorized or performed.

The full integration suite passes all 296 tests across 38 files after explicit feature-module
imports. Full unit verification passes 523 tests across 58 files. Lint (including Stylelint),
Knip, formatting, type checking and every workspace production build pass.
`pnpm deploy:check` renders local, preview and deployment definitions. Built deadline-worker smoke
passes overdue execution, restart idempotence and SIGTERM shutdown; built frontend/backend smoke
passes health, headers and the synthetic Apple authentication boundary. PostgreSQL, Redis and
MinIO verification uses only new disposable local services.

All twelve focused notification browser checks pass in the digest-pinned Playwright image with
Node 24.15.0. They cover the original read/empty/error/offline cases, Club-frame keyboard navigation
at 390/1440, reverse Tab after reads, heartbeat silence, five-minute reconciliation and a signal
received during an earlier REST request. No screenshot baseline is changed. The full selected UI
gate also passes all 202 checks: 96 smoke tests and 106 exact visual comparisons. Existing zero-pixel tolerance remains unchanged.

All four disposable test containers and their anonymous volumes are removed after verification.

The staged gitleaks scan passes without an allowlist change. The managed worktree is retained for
the existing PR; this round creates no manual worktree.
