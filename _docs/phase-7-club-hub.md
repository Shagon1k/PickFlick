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
  Membership and Hub response before saving the preference. Direct Club visits also update the
  preference; `/app` never trusts the cookie without checking Memberships.
- `GET /clubs/:clubId/hub` returns one membership-scoped snapshot: Club summary, member and Session
  counts, an active Session when one exists, and five recent Sessions. It uses a repeatable-read
  transaction and private, no-store responses. The frontend fetches without a cache and renders
  the complete projection for one Club route.
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
- Completion remains pending until the exact head SHA is on preview and the owner acknowledges the
  visual review required by issue #33.
