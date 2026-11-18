# Phase 19 — Privacy and personal-data surfaces

Working evidence for [#69](https://github.com/Shagon1k/PickFlick/issues/69).
Project 3 owns live status. Keep this document while Phase 19 is active.

## Owner decisions and delivery boundary

The bounded predecessor conversation from thread `01a1e43b-ceb8-7433-adf6-285c3b9fb5e0`
records the owner's acceptance of these proposals, in source order:

- Prepare preview drafts with literal `{TODO_OPERATOR_NAME_HERE}`,
  `{TODO_OPERATOR_ADDRESS_HERE}` and `{TODO_REGISTRATION_DETAILS_HERE}`. Keep
  `hello@pick-flick.app` as the public contact. Lithuanian individual activity is an option,
  not a confirmed registration or operator form.
- Keep immediate account-access revocation, a 24-hour private-cleanup operational target,
  seven-day archive availability from generation, 30-day event logs, 90-day event audit,
  30-day backups from creation, 90-day support/privacy correspondence after closure and
  90-day completed export/deletion metadata without archive contents. Shared references need
  separate handling. Reapply deletions before using restored backups.
- Limit exceptions to necessary data for a specific legal obligation, dispute or investigated
  incident; record the reason and remove data when that basis ends. Review financial periods
  before enabling billing.
- Preserve shared ratings and comment text under “Deleted user”. Handle requests about personal
  details in free text manually: verify the request, remove the passage or the particular comment,
  and preserve the rating and Session. No automatic scanning or irreversible-anonymity promise.
- Verify providers/cookies and add archive request, status and download to Settings using the
  existing API.

The owner approved these product boundaries with “В целом согласен со всем”. The current
successor instruction authorizes implementation, focused commits and same-branch pushes. It
preserves the remaining operator, exact-copy legal/privacy and exact-head hosted visual gates.
No registration, legal consultation, public-policy approval, merge or deployment is claimed.

## Copy-to-implementation matrix

| Surface and statement                                                                                                      | Evidence                                                                                                                                                                | Limitation / disposition                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy/Terms identify the draft and literal operator TODOs                                                                | `legal/[document]/legal-content.ts`, `privacy-content.ts`, `terms-content.ts`; public page warning                                                                      | Real identity/address/registration, reviewer and effective revision pending owner + reviewer.                                                |
| Account/profile, preferences, Club/Session contributions, Library, security/delivery records                               | Prisma schema; [policy inventory](phase-19-privacy.md#data-inventory); account, archive and notification projections                                                    | No promise of no location information: members can enter venues and other free text.                                                         |
| Google enabled; Apple gated                                                                                                | `auth.config.ts`, enabled-provider login projection                                                                                                                     | No live OAuth/provider account audit in this task.                                                                                           |
| Hosting/Cloudflare, PostgreSQL/Redis/private objects; Resend/Workspace; configured catalog adapters; YouTube after Play    | [Security](security.md), [Architecture](../ARCHITECTURE.md), [email operations](email-delivery.md); `TrailerPlayer`, catalog/media adapters                             | Provider entities, contracts, regions, transfers and deployed storage behavior await external review. Paddle/Sentry remain planned.          |
| Session cookie: seven days with one-day renewal; last-Club session cookie; transient sign-in storage                       | `auth.config.ts`, `last-club.ts`; browser Movie checks cover no player before Play                                                                                      | No blanket cookie-banner exemption. Mocked playback cannot certify real YouTube storage or consent.                                          |
| Personal Ratings CSV preview/import/export; historical Session Ratings separate                                            | [CSV reference](ratings-csv.md), existing actions and UI                                                                                                                | No new CSV format or import behavior.                                                                                                        |
| Own archive, manifest exclusions, seven-day availability, authenticated five-minute links, delayed physical expiry cleanup | [Archive reference](gdpr-archives.md), existing `data-exports` backend; new Settings adapter/actions/controls                                                           | Includes only the existing field allowlist. No mailbox/log/backup export or legal-compliance certification.                                  |
| Immediate access revocation; private-file cleanup target; shared history and free text preserved                           | [Deletion evidence](phase-19-account-deletion.md), existing deletion API and UI regression checks                                                                       | Retained IDs and text are not proven anonymous. No cancellation of unimplemented billing.                                                    |
| 30/90-day retention, backup restoration and 180/360-day inactivity policy                                                  | Owner decisions above; [prior policy preparation](phase-19-privacy.md)                                                                                                  | Broader automation is unbuilt. Public copy explicitly calls these targets/plans; #74/#83/#87/#88 retain implementation/evidence.             |
| Rights/request contact, proportionate identity checks and complaints                                                       | [EDPB rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en), [Lithuanian authority](https://vdai.lrv.lt/en/) consulted 2026-11-18 | Reviewer must approve basis/market-specific text and the manual process. Inbox ownership and response handling have not been exercised here. |
| 16+, Europe + US intent; final commercial and legal provisions pending                                                     | Earlier owner decisions in policy preparation; current Terms draft                                                                                                      | No new age checks, content license, governing-law decision or payment terms.                                                                 |

## Settings implementation

Reuse the current Settings shell, flat panels, shared Buttons and deletion ConfirmDialog.
The data summary uses native keyboard-operable disclosure controls and links to the public
Privacy Notice rather than repeating policy text. The archive panel requests and manually
refreshes the existing job; it reports pending, processing, ready, failed and expired states.

An interrupted request retains its UUID until it succeeds. Accepted job IDs enter the page's
`archive` query parameter so reloading that address can recover status. The backend derives
ownership from the current session on every status/link/download request. There is no new
job-list API or browser storage. Losing the address loses the UI shortcut; another tab with an
active job receives an actionable conflict message until that job finishes.

Server actions validate unknown input with the existing contract and forward through server-only
API adapters. Binary download uses a small browser API adapter for the signed same-origin URL;
it checks HTTP failures before creating a temporary Blob download. Signed URLs are not persisted
or rendered as links. Network failures leave feedback inside Settings. Large archives are held
in browser memory during download, matching the bounded current archive implementation; streaming
and background polling are out of scope.

## Verification and outstanding acceptance

Local checks use Node 24.15.0 / pnpm 11.25.0 and CI's digest-pinned Playwright 1.63.0 Noble image.

- `pnpm test:unit`: all 701 tests across 76 files pass, including the new action-boundary cases.
  Contract selectors/malformed references are rejected before API calls; uncertain request UUIDs
  and auth/expiry/conflict/rate-limit feedback are covered.
- The first focused browser run passes all 35 behavior checks across public pages, deletion and
  archives. The explicit visual update passes all 12 selected checks and changes eight existing
  PNGs: Privacy, Terms, pricing and the Settings privacy panel at 390/1440. Dialog, Landing and
  Contact baselines remain unchanged. No tolerance, mask or quality gate changed.
- Rendered `settings.html?tab=privacy` at both widths, the responsive Control baseline and the
  canonical Design contract were inspected against the implementation. The established public
  legal layout and public-shell source govern Privacy/Terms; there is no separate canonical
  legal prototype. All eight changed PNGs were inspected against their previous captures, with
  full-size mobile checks of operator TODOs, long paragraphs, headings and the footer. The
  policy summary override in DESIGN replaces the prototype's six policy-copy sections; the
  archive panel uses the existing Settings card and shared controls.
- A later keyboard test initially selected the disclosure text span after chevrons were added.
  The locator now targets the native `summary`; a direct keyboard probe confirms Enter opens it.
  One overlapping test-run attempt also deleted another run's trace artifacts. Final verification
  uses an isolated artifact directory and a single browser runner against the existing build.
- `pnpm knip` passes. Package type checks and frontend production builds pass. Full ESLint passes;
  the resulting Stylelint ordering finding was corrected. Final full Stylelint, Prettier and root
  TypeScript checks pass. All 62 focused browser checks pass without retries or baseline updates,
  including all strict visual comparisons and Movie player/links/accessibility checks at four widths.
  The final run uses the standard UI configuration with only the web-server command shortened to
  start the already-verified production build, plus a separate artifact directory.
- `pnpm security:audit` fails: 11 findings (2 low, 8 moderate, 1 high). The existing lockfile's
  `picomatch` paths are covered by [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
  reviewed 2026-11-17; the advisory lists versions through 4.0.7 and no patched release. The
  lockfile/dependencies are unchanged and the production high/critical gate remains intact.
  Dependency remediation or an explicitly reviewed disposition is separate work.

- Exact-head hosted preview and owner mobile/desktop acknowledgment: **pending**. This run
  does not authorize deployment.
- Operator details, legal/privacy reviewer assignment and exact-copy approval: **pending**.
- Deployed provider/edge/player storage audit, request-process exercise and retention/restore
  evidence: **pending**. Source review and mocked browser evidence do not replace these gates.

No issue acceptance checkbox or phase-completion marker is set by this implementation.
