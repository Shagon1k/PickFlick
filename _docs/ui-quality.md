# UI quality checks

The UI scripts build the web app, start it on loopback against a mock API
(`tests/ui/start-frontend-with-mock-api.ts`), and run Playwright in Chromium over
the public pages, Login, Club onboarding, Hub overview, settings, Club invitation states, the recovery
states, Hub membership restrictions and pending invitations, the `/ui-preview` component gallery,
live Session creation/edit/cancellation, member-only Session invitation responses and roster
management, Nomination submissions and personal suggestions, immutable Selection ballots,
policy-filtered Selection results and early-close confirmations, historical Session Rating submission,
partial completion and permitted results, Completed facts/ratings/nomination disclosures, Hub
Sessions with concurrent Ratings and policy-filtered history scores, Club analytics and paginated
Ratings sorting at all four representative widths, and the seven `/shell-preview/*` shells.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:ui:smoke
pnpm test:ui:contract
pnpm test:ui:visual
```

Run these commands, journeys and other frontend builds sequentially. They share
`apps/frontend/.next`; rebuilding while a test server is running invalidates its assets and Server
Actions.

`pnpm test:ui` runs the full suite. Playwright's `@smoke` tag selects PR behavior checks with
`test:ui:smoke`: security headers and CSP, Club switching and stale access, invitation sign-in
continuation and responses, member removal, landing accessibility, a pricing interaction, product shell navigation, global Movie search and read-only Movie Details at 390, 768, 1024 and 1440px, and overflow
at 1024px, plus full-cycle creation/edit/cancellation, keyboard pre-selected Movie creation, Session invitation
privacy and sign-in continuation, accepted-roster leave, operator invitation/removal focus, and personal-suggestion nomination with privacy and submission locking, plus Selection completeness, keyboard scoring and immutable submission. Screenshot comparisons use the `@visual` tag;
`test:ui:contract` excludes it, and `test:ui:visual` selects it. The contract selection includes
accessibility, keyboard and touch interaction, security headers and CSP, responsive overflow,
reduced motion, and other behavior assertions.

The suite checks:

- axe accessibility rules at 390 and 1440 pixels;
- keyboard, focus, form constraints, live regions, menus, tabs, score controls, dialogs, and shell
  overlays (the gallery flow lives in `interaction.spec.ts`);
- 44px touch targets and locally scrolling dense regions;
- no horizontal page overflow at every breakpoint and gap width (390, 640, 768, 900, 1024, 1200,
  1440);
- exact screenshot matches at 390 and 1440 pixels (visual selection);
- collapsed motion when reduced motion is requested.

Viewports are defined once in `tests/ui/viewports.ts`. Visual captures include Movie Details,
Session creation, Nomination, Selection and its outcome, Watching and Rating,
Completed history and Hub history, Personal Rating and Watchlist editors, Club Ratings, Library
tables and statistics, and the shared achievement shelf alongside the existing coverage.
`tests/ui/phase-states-visual.spec.ts` reuses the behavior fixtures for these later states.
The Nomination viewport checks also assert the Session header variant and the two-column to
single-column layout change at 1024px. Hub checks verify that tab navigation keeps the upper frame
mounted without document navigation, the creation slide is last, Watching uses real film metadata,
and Manage Club aligns with the shared Call Sheet. Archived settings captures return to the top
after checking dialog cancellation, so sticky chrome does not move into the middle of a full-page
capture.

## Review a failure

Playwright writes screenshots, diffs, video, traces, and an HTML report under `test-results/`; CI
uploads them when the job fails. Open the report with:

```bash
pnpm exec playwright show-report test-results/ui-report
```

## Update baselines

Change baselines only after the rendered result matches the canonical design. Run this in the
digest-pinned Linux Playwright image used by CI, with Node 24.15.0 from `.node-version`:

```bash
pnpm test:ui:update
```

Inspect every changed PNG and rerun `pnpm test:ui:visual` in that image before committing. An
updated baseline is not proof that a visual change is right.

Add a representative reviewed capture at 390 and 1440 for each new screen in the same PR.
Add another state only for a materially different composition. Permissions, validation, errors,
empty results and saved feedback normally belong in behavior tests. Record the prototype and
review findings in the PR. Visual tests assert that the intended content has loaded before capture;
use fixed fixture dates for visible timestamps and statistics.

## CI

One UI job runs as a matrix. PRs select `UI smoke` and `UI visual` checks for affected areas;
main pushes and manual CI runs use the full `UI contract` and `UI visual` suites.

`scripts/run-ui-checks.mjs` compares the PR with its base using Git's merge base and passes test
file paths to the existing Playwright commands. It combines all affected areas:

| Changed source or baseline                                                               | Selected area                                                                                |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Marketing routes, contact API                                                            | Public pages                                                                                 |
| Club invitation routes (`/invite/club/[token]`)                                          | Club invitations                                                                             |
| Session invitation routes (`/invite/session/[token]`)                                    | Session roster                                                                               |
| Login routes                                                                             | Authentication                                                                               |
| Club routes (except Session creation), Club/invitation API                               | Club onboarding, Hub, invitations, members, settings, Ratings and Achievements               |
| Session routes/components/API, including `/clubs/[clubId]/sessions/new`                  | Session workflows, roster, Nomination, Selection, Watching, Rating, history and Hub          |
| Movie routes/API                                                                         | Movie search/details, Personal Rating and Watchlist                                          |
| Library routes, achievement component, Library/achievement/personal-rating/Watchlist API | Library, statistics, Achievements, Club Ratings, Movie Details and rating/Watchlist controls |

The compact later-screen visual file is included in each relevant product area. Changed test
specs run directly; feature baseline updates select their area too. Shared components/styles,
layouts, UI fixtures, contracts, configuration, dependencies, the selector and CI changes run all
smoke and visual checks. Unmapped frontend or UI test paths also run both full selections.
Documentation/backend-only changes skip mock UI checks; the other CI jobs still run.
The shared authentication adapter `src/api/session.server.ts` runs both full selections.
A selected area with no tests carrying that suite's tag succeeds without starting the app.
The Git comparison trusts only the current checkout directory for that command because the CI
container user differs from the checkout owner. It does not change stored Git configuration.

All UI runs use Linux in `mcr.microsoft.com/playwright:v1.63.0-noble`, pinned by digest in
`ci.yml`, with the locked Node and pnpm versions. CI retries a failure once and fails flaky tests.
The Delivery gate requires every selected check to pass. Missing or mismatched baselines fail it.
Normal runs use `updateSnapshots: 'none'`; only the explicit update command writes baselines.
To run both full suites before merging, open **Actions → CI → Run workflow** and select the branch.

On `main`, contract and visual regression must pass before `deploy-uat.yml` can deploy the exact
revision and upload its `uat-<sha>` screenshot artifact. A passing branch run does not prove that
the merged revision deployed; check those workflow results after merge.

## Baseline review, 2026-10-26

The 13 failures from CI run `40315852675` were reviewed as expected/actual/diff triplets against
the canonical sources below. The checkout also includes the Achievements delivery, so the
refreshed Hub captures include its tab. These are delivered feature changes; no pixel tolerance
was relaxed.

| Existing baselines                                         | Canonical source                        | Review finding                                                                                                                                                                |
| ---------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `club-hub` at 390/1440                                     | `app.html`, DESIGN Hub statistics rules | Delivered Sessions/Ratings/Achievements tabs follow the source navigation. Free Clubs show two real counters and the Pro explanation instead of seven placeholder statistics. |
| `pending-invites` at 390/1440                              | `app.html` invitation popover           | The same Hub changes move the content behind the popover; the invitation surface and actions retain their composition.                                                        |
| `club-members-{admin,adminless,member,over-limit}` at 1440 | `app.html` Members                      | Shared Hub navigation adds the delivered tabs; membership rows and role/limit notices retain their layout.                                                                    |
| `club-settings-{admin,member,archived}` at 1440            | `app.html` Manage Club                  | Shared Hub navigation adds the delivered tabs; settings columns, permission restrictions, and danger controls retain their layout.                                            |
| `movie-details` at 390/1440                                | `movie-details.html`                    | Personal Rating and Watchlist controls replace read-only placeholders. The media/credits/synopsis composition is retained.                                                    |

The later-state captures use the existing mock scenarios and shared 390/1440 viewports. Compact
film metadata keeps the phase workflow visible; long-content coverage remains in the behavior
fixtures and the Library statistics capture. Source review covers composition and responsive
behavior, not equality with prototype fixture films, counts, permissions, or proposed features.
The phone film ticket follows the approved refinements in [DESIGN.md](../DESIGN.md#watching);
phase controls and result visibility follow its current Session rules.
The review corrected the shared Achievements shelf to the prototype's continuous grid: two
columns on phones, three at medium widths, and five on wide screens, with centered display
titles and the earned badge highlighted. Versioned rule explanations and privacy text remain
part of each card.
Film metadata now occupies the available header width before its wrapping check, keeping the
hairline stable when short facts and genres fit on one line.
The existing roster smoke check waits for the Session settings menu reveal with `settle` before
clicking Kick.
The pre-selected Movie smoke flow observes its client-side mode change before filling Date and
Location, so hydration cannot clear values filled into the server-rendered form.

The owner review reduced the added set from 74 to 22 PNGs: eight representative page states
and two editor flows at both widths. Distinct phases and the Watchlist table remain covered;
permission/error/empty/save variants stay in the existing contract tests.

| Area                   | Representative capture                               | Canonical source                                                              |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Selection outcome      | Winner and ranking                                   | `session-detail-selection.html`, shared Watching hero, DESIGN Selection rules |
| Watching               | Operator screen                                      | `session-detail-watching.html`                                                |
| Rating                 | Rating form                                          | `session-detail-rating.html`                                                  |
| Completed history      | Completed ratings/rivals and Hub history             | `session-detail.html`, `app.html` Sessions                                    |
| Personal Rating        | Editor                                               | `movie-details.html`                                                          |
| Watchlist              | Priority editor and populated Library                | `movie-details.html`, `library.html`                                          |
| Club Ratings           | Populated leaderboard                                | `app.html` Ratings                                                            |
| Library and statistics | Populated Ratings table and statistics               | `library.html`                                                                |
| Achievements           | Shared shelf with earned, progress and private cards | `library.html`, `app.html`                                                    |

The retained captures were reviewed in the original pinned-image run. The original full run passed
154 visual and 91 smoke tests; the review removes 50 visual tests and 52 PNGs without changing
retained images. After reduction, all 20 retained later-screen visual tests pass again in the pinned
CI image with four workers, without retries or baseline updates. The selector passes 13 unit cases
and CLI checks for scoped arguments, no-UI changes, full manual runs and failure propagation.
A real Git checkout owned by another user reproduces the CI failure; the command-scoped directory
trust fixes it and selects only the expected Library tests.
Playwright listing confirms 22 visual tests for Library changes, 28 for Session changes and 10 for
public-page changes, versus 104 for shared changes. The inventory has 53 complete 390/1440 pairs.
Main, Delivery and the UAT artifact still require verification after merge.
