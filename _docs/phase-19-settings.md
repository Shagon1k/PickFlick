# Phase 19 — Personal Settings

Implementation and verification notes for [#65](https://github.com/Shagon1k/PickFlick/issues/65).
Project 3 owns live issue status. Keep these notes while Phase 19 is active, then consolidate
verified behavior into canonical documents.

## Authorization and boundaries

The owner explicitly authorized #65 in the bounded predecessor conversation on 2026-11-10:
“Proceed with #65. Keep unresolved legal/privacy decisions gated separately.” The successor
continues the same managed branch. Age 16+, Europe + US intent, and inactivity archiving decisions
are recorded in [privacy preparation](phase-19-privacy.md); they add no runtime work to this issue.

Reuse private S3 storage, the authenticated account-avatar endpoint, shared Mantine controls,
ColorReveal configuration and film tables. Profile and Appearance are delivered here. Other
Settings sections retain navigation but their pending capabilities belong to their owning issues.
No provider linking, public legal copy, account deletion, export, inactivity jobs, billing,
production setup or provider account changes are included.

## Implementation

- `GET /account`, `PUT /account/profile` and `PUT /account/appearance` always derive identity from
  the authenticated session. Strict schemas reject account selectors and non-profile fields.
  Email/providers are read-only. Locale remains English, with a persisted locale field.
- The product route layout loads per-user preferences. Monochrome applies to film images and
  trailer frames; quiet mode removes grain without suppressing loading/focus feedback. Compact
  spacing uses shared tokens. There are no continuous decorative animations in current product
  surfaces to disable. System reduced-motion rules still apply.
- ColorReveal combines the existing central switch with the personal preference. Preference
  changes cancel active animation and restore ordinary hover feedback. Action press feedback and
  the three film tables retain their existing independent behavior.
- One column preference format and control cover Club Ratings, My Ratings and Watchlist. Film
  and Rating/Priority cannot be hidden. Unsupported optional columns are ignored. Hiding a column
  preserves the current server sort, filters and pagination.
- Personal uploads are private to the self-only account-avatar endpoint. Existing member and
  participant endpoints retain provider-photo permissions; this issue grants no peer access to
  uploaded objects. Browser responses contain no storage keys or provider source URLs.
- Uploads are capped at 512 KiB, matching the existing bounded avatar flow. MIME/signatures and full decoding
  are checked before storage. The existing locked Sharp version is a direct backend dependency.
  The decoded input budget is 16,777,216 pixels; orientation is applied and output is a fresh static WebP
  within 512 × 512 without enlargement, EXIF or ICC metadata.
- Migration `20261110000100_account_settings` adds User appearance/avatar fields and an object
  tracking table. Track objects before storage, serialize User pointer changes, and clean replaced
  or failed uploads immediately. Failed cleanup leaves tracking rows for a ten-minute bounded
  sweep of unreferenced objects older than one hour. Reference checks and object-row locks prevent
  cleanup from deleting an attached object. This covers personal avatar objects only; broader
  retention and catalog cleanup remain #87.

## Evidence and open checkpoints

- `pnpm verify` passed: lint, formatting, types, Knip, 669 unit checks and both production builds.
  The dependency audit reported eight existing low/moderate findings, with no high/critical findings.
- The final full integration run passed 341 database/API checks on fresh task-owned PostgreSQL,
  including omission of private avatar fields from the real Better Auth browser response. The
  shared test database was missing two historical constraints; it was not reset or repaired.
- Six native decoder cases pass: PNG/JPEG/WebP normalization, orientation/metadata removal,
  corrupt content and a decompression pixel budget. The pruned production package also loads and
  decodes WebP in the Dockerfile's pinned Node runtime image.
- A real MinIO smoke check passed normalized upload and authorized read, replacement deletion,
  removal deletion, and removal of the corresponding tracking rows.
- Canonical references inspected: `settings.html`, prototype Design contract, responsive baselines,
  and canonical `DESIGN.md`. Profile/Appearance have four new reviewed 390/1440 captures; six
  existing table captures were reviewed and updated. See [baseline review](ui-quality.md#personal-settings-baseline-review-2026-11-10).
- The final Settings suite passed 9/9; the full smoke suite passed 120/120 and the full visual
  suite passed 116/116 in the pinned Playwright image. Checks include accessibility, keyboard controls, account isolation,
  persistence, validation, offline/error/loading states, and local table scrolling.
- A final audit found and added the monochrome marker to trailer thumbnails as well as the
  playing iframe. After rebuilding, all 24 Settings/Movie Details checks passed, including both
  thumbnail layers and the playing frame. Focused ESLint, test types and the frontend build passed.
- Initial combined PR selection: 229/236 passed. Six expected table-baseline differences were
  subsequently reviewed and updated. The remaining failure was an intermittent menu-opening
  timeout in the existing two-client Nomination smoke test. It also reproduced on starting commit
  `d0ac433fda367dd3759140ef869023433511f357` (four of five baseline repeats passed).
  Attempted test-only waits and keyboard input did not resolve it and were removed. No Nomination
  implementation or test changes are included. The final full smoke rerun passed all 120 checks,
  including that unchanged test; CI must still pass before delivery.
- Exact-head hosted preview and owner visual acknowledgment: required and pending. Do not mark
  the issue or phase Done based on local screenshots or CI alone.
- Legal/privacy package acceptance remains separate and open.

## Review fix round 1

The bounded review of `49efb45af25a9f70a984e074d05467800e333ad8` identified two Settings
composition regressions. Compact navigation, hidden account context and full-width content now
continue below 1024px. Profile feedback occupies the existing Save changes row, so successful
saves preserve the card and button geometry.

Four browser checks cover navigation, save geometry, accessibility and overflow at 390, 768,
1024 and 1440px. Geometry assertions account for browser scrolling when Save changes receives
focus. The existing Profile and Appearance screenshot baselines match in the pinned Playwright
image without updates. Hosted preview acknowledgment remains required.

The pinned-image smoke/visual selection plus the three remaining Settings contract checks finished
with 242 passed and one flaky check. All 13 Settings checks passed. The unchanged two-client
Nomination smoke check timed out initially and passed on retry; CI mode rejects that flaky result.
This is the same intermittent check documented above. No Nomination code or tests were changed.
The dependency audit, lint, Knip, formatting, type checking, all 669 unit tests and both production
builds passed.

## Review fix round 2

The bounded review of `cf61c29465aab957f63cca3510e6644fd726960f` identified an Appearance
initialization bug and duplicated sign-out behavior. Appearance now starts from the account
fetched by Settings, so a failed account read in the persistent product layout cannot replace
saved preferences with defaults on a later save. Both sign-out callers use the same request and
success-only full document redirect; their offline, pending and accessible feedback stay intact.

Browser coverage includes client navigation after the initial account-read failure, preservation
of other saved preferences when changing one setting, and Settings sign-out offline/error/retry
behavior. Existing shell checks cover successful sign-out and retry after failure.

`pnpm verify` passed: dependency audit, lint, Knip, formatting, type checking, all 669 unit
tests and both production builds. The audit reported the same eight low/moderate findings and
no high/critical findings.

All 15 Settings checks passed in the pinned Playwright image, including the recovery and
sign-out regressions, responsive/accessibility checks and unchanged Profile/Appearance baselines.

The combined full smoke/visual selection plus Settings and shell sign-out contract checks finished
with 260 passed and one failed. All smoke and visual checks passed, as did the existing shell
sign-out success/retry checks. The additional `Library and Settings menus expose distinct
subsection destinations` contract check failed because its expected menu omits Appearance.
Both that assertion and the menu's Appearance link are unchanged from the reviewed source commit.
This unrelated assertion remains outside the two-item fix scope; the combined command returned
failure. No screenshot baselines changed. Exact-head hosted preview acknowledgment remains required.
