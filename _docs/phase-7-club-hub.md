# Phase 7 — Club Hub and invitations

Phase 7 is active while [#33](https://github.com/Shagon1k/PickFlick/issues/33),
[#34](https://github.com/Shagon1k/PickFlick/issues/34), and
[#35](https://github.com/Shagon1k/PickFlick/issues/35) are delivered. The
[Roadmap](../ROADMAP.md#phase-7--club-hub--club-invitations--in-progress) owns acceptance and
Project 3 owns live issue status.

## Issue #33: Club switching and overview

- `/app` loads current Memberships and opens the last used Club. If the preference is stale, it
  opens the first current Club; with no Memberships, it keeps the no-Clubs state.
- The switcher submits one Club choice through a server action. The action checks the current
  Membership and Hub response before saving the preference. If access is revoked between those
  checks, it returns to `/app` without changing the preference. Direct Club visits update the
  preference only after the API authorizes the Hub request; denied or failed requests preserve the
  previous preference. `/app` never trusts the cookie without checking Memberships.
- `GET /clubs/:clubId/hub` returns one membership-scoped snapshot: Club summary, member and Session
  counts, an active Session when one exists, and five recent Sessions. It uses a repeatable-read
  transaction and private, no-store responses. The frontend fetches without a cache and renders
  the complete projection for one Club route.
- The active Session query prefers Nomination, Selection, or Watching, then the most recently
  updated Rating Session. Rating lookup is independent of the five recent Sessions, so newer
  Completed Sessions cannot hide an unfinished Rating Session from the Call Sheet.
- The Session skeleton has no Movie, runtime, genre, nominations, attendance, or ratings yet. The
  Call Sheet and activity show only fields that exist. The empty state names what will appear when
  Sessions are created. Scheduled call time is labelled UTC until the Session scheduling flow owns
  a member-local time-zone presentation.
- Archived Clubs show a read-only notice. Unauthorized Clubs show no Club details. Session and
  member management, invites, film metadata, and achievements remain in their owning issues.

## Verification in progress

- Club API integration: 2 focused tests passed against isolated PostgreSQL after all nine
  migrations. They check Club-specific counts and Sessions, private no-store headers, and 404
  after Membership removal.
- Browser: the full contract run passed 99/100; its 768px Hub overflow was fixed. The focused Hub
  rerun then passed all 6 keyboard, touch, stale preference, unauthorized, accessibility, and
  responsive checks.
- Visual: 44 captures updated and 44/44 comparisons passed in the digest-pinned Linux Playwright
  image at 390 and 1440 pixels. The Hub images and changed Club settings images were inspected.
- Static gate: `pnpm verify` passed, including lint, formatting, unused-code check, type checks,
  130 unit tests, and production builds.
- Review fix round 1: `pnpm verify` passed with 138 unit tests and production builds. All 43
  database/API integration tests passed against isolated PostgreSQL with the nine existing
  migrations and synthetic seed. The smoke selection and Hub behavior checks passed 11/11,
  including direct-visit preference preservation, keyboard, touch, accessibility, and responsive
  checks. Unit tests cover revocation between the Club list and Hub requests; the Hub integration
  test covers Rating Sessions older than five recent Completed Sessions and blocking priority.
- Completion remains pending until the exact head SHA is on preview and the owner acknowledges the
  visual review required by issue #33.

## Issue #34: Club invitation lifecycle

- Admins and Moderators create seven-day, single-use invitation links from Manage Club. The API
  also supports a registered recipient ID; another account gets the same generic invalid state.
  Creating a shareable link does not reserve a seat. The UI displays its raw link once and can copy
  it; neither local storage nor the invitation row keeps the token. Recent invitation rows contain only
  IDs, expiry, and state. Creating and revoking links append Club audit events.
  The list includes the newest 20 records plus every live pending link. Creation preserves its
  returned token when list refresh fails, showing a separate warning and keeping revocation available.
- Ten migrations now include `ClubInvite`: a unique SHA-256 digest of 32 random bytes, Club,
  inviter, optional target, expiry, revocation, and the responder's decision and timestamp.
  Membership creation and its audit record share the response transaction. Decline records the
  decision on the invitation and creates no Membership.
- Every invitation API requires an authenticated registered User. Preview returns only the Club
  name, active member count, inviter display name, and expiry for a usable invitation. Invalid,
  wrong-target, consumed-by-another-user, expired, revoked, full, archived, deleted, and adminless
  invitations disclose no Club details. An already active member receives only their Club route.
- Accept, decline, and revoke lock the Club row, then re-read eligibility. This serializes
  acceptance across different links and lifecycle writes. The existing active-Membership unique
  index remains the final duplicate guard. Rejoining creates a new Membership and preserves the
  departed row. Entitlements still use the existing Free/seeded Pro projection until Phase 20.
- `/invite/club/[token]` preserves the same mascot and card structure across loading, sign-in,
  valid, success, decline, and recovery states. Sign-in returns to the invitation and leaves the
  acceptance decision to the User. Success opens the authorized Club Hub. Network failures leave
  the choice available for retry. The page is noindex, private/no-store, and no-referrer.
  Maximum-length Club names are visually ellipsized on one line, with the full heading text still
  accessible, so acceptance and decline keep the same card dimensions.
- Token input travels in POST bodies to fixed API paths. HTTP logs redact request URLs, referrers,
  cookies, authorization, redirect locations, and set-cookie headers. No raw token is added to
  invitation or Membership audit records.
- The pending-invite ticket/popover and Hub Members view remain in issue #35; Session invites
  remain in Phase 9.

### Invitation verification

- All ten migrations applied to a new isolated local test PostgreSQL database.
- All 52 database/API integration tests passed, including eight invitation tests for authorization,
  privacy, expiry/revocation, decline retries, historical rejoin, five concurrent accepts, and two
  distinct links competing for the eighth Free seat, and accept/revoke serialization.
- `pnpm verify` passed: lint, formatting, unused-code and type checks, 142 unit tests, and production
  builds. Logging tests exercise actual HTTP redaction and discard provider error arguments.
- The Google authorization initiation test preserves the invitation return path in the existing
  short-lived OAuth state and keeps it out of the provider authorization URL. Browser continuation
  uses a mocked provider callback; a live provider exchange has not been verified.
- The full browser contract selection passed 105/105. All 26 focused invitation checks passed after
  correcting the heading to avoid implying reserved capacity, including sign-in continuation,
  keyboard acceptance into the correct Hub, offline retry, manager controls, privacy, accessibility,
  and stable geometry across seven widths. The 22 invitation captures and six changed Manage Club
  captures were inspected at 390 and 1440 pixels.
- All 66 visual comparisons passed in the digest-pinned Linux Playwright image. Exact-SHA hosted
  preview and owner visual acknowledgement remain required before completion. This run did not
  execute the separate built-stack `pnpm test:e2e` smoke command.

### Review fix round 1 verification (2026-10-04)

- `pnpm verify` passed, including 231 unit tests and workspace builds. The sandbox run used a writable
  copy of pnpm's store metadata; installed dependencies were unchanged. The final stylesheet also
  passed Stylelint, Prettier, and a fresh frontend build after limiting text clipping to the horizontal axis.
- All 54 database/API integration tests passed against the isolated `pickflick_test` database.
  Regressions cover an older pending link after 20 newer revocations and more than 20 pending links.
- All 10 PR smoke checks passed. All 28 invitation browser checks passed in the pinned Playwright
  image, including list-refresh failure, maximum-length Club names across seven widths, and all 22
  unchanged screenshot baselines. Long-name previews were inspected at 390 and 1440 pixels.
