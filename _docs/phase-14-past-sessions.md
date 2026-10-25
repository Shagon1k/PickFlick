# Phase 14 — Past Sessions

[Roadmap scope and acceptance](../ROADMAP.md#phase-14--past-sessions--shared-history--in-progress)
remain canonical. Project 3 owns the live status of [#52](https://github.com/Shagon1k/PickFlick/issues/52)
and [#53](https://github.com/Shagon1k/PickFlick/issues/53).

Run `r_29040fec8b495f603abc` implements #52 on the managed branch
`PF-52_14-1-record-minimal-past-sessions`. It reuses Club authorization/locking, settings snapshots,
historical Membership references, Movie picking, Completed detail and Hub history. Optional nomination
and score-matrix reconstruction is implemented by #53 as described below.

Past Sessions enter Completed directly. Attendees and 1–10 ratings preserve only supplied evidence.
The PAST Session type records imported provenance; imported ratings have no submission timestamp.
Migration 28 permits those null timestamps while retaining immutable responses and the live Rating
phase guard. Deploy the migration before the API. No existing rows are backfilled.

Former Memberships may be selected explicitly. References preserve attribution through later
departure or anonymization. Repeat screenings reuse one canonical Movie in distinct Sessions.
The picker lists each person once using their latest Membership. Duplicate attendee entries,
including two Memberships for a rejoined person, and cross-Club Membership IDs are rejected. Empty attendee selections
mean no attendance evidence was supplied. Live Session date validation remains unchanged.

Verification covers partial-data API/database integration, provenance constraints, authorization,
real-API browser creation, responsive validation, keyboard/touch, axe and retained input on failures.
Local verification on 2026-10-23 uses Node 24.15.0 and pnpm 11.25.0 with an isolated,
seeded `pickflick_test` database.

| Check                   | Result                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm db:migrate`       | All 28 migrations applied                                              |
| `pnpm test:integration` | 25 files, 229 tests passed, including 8 past-Session checks            |
| `pnpm test:journeys`    | All 11 passed, including 5 past-Session checks and existing live flows |

`pnpm test:ui:smoke` passed all 54 checks, including existing Session creation, Movie picking,
Completed history and Watching/Rating regressions.

`pnpm lint`, `pnpm knip`, `pnpm format:check` and `pnpm typecheck` passed.
`pnpm test:unit` passed all 350 tests across 48 files. `pnpm build` passed every workspace build.
The audit gate initially blocked `pnpm verify`; CI repair attempt 2 below clears it.

The past-Session journeys check 390/768/1024/1440px layouts, axe, keyboard/touch ratings,
clear-to-unknown behavior, offline retention, request failure recovery, Member denial and the
resulting Completed record. Local form and result captures are in
`test-results/past-{form,completed}-{viewport}.png`; phone and desktop captures were inspected.
Visual baselines were not updated.

The repository has no hosted-preview workflow. #52 requires its exact final SHA on a hosted preview
and owner visual acknowledgment before acceptance. Local captures and a Draft PR do not satisfy it.

The new browser checks exposed two shared UI regressions: setup cards could grow wider than a
phone when a rating rail appeared, and keyboard Movie selection retained an ARIA reference to a
removed result. The shared card now permits shrinking, and the picker clears its active option.

CI repair attempt 1 on 2026-10-24 addresses the failed dependency audit in
[run 40028517461](https://github.com/Shagon1k/PickFlick/actions/runs/40028517461).
The authorized source was `dc3f290fa162fc4b1f7585079d1068ce354e94da`. Only Zod changes:
the catalog and lockfile use the published 4.6.6 patch for
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), within existing consumer
ranges. The frozen install and all 120 focused contract, environment and validation-pipe tests pass.

After attempt 1, the audit no longer reported Zod. `pnpm verify` still stopped at its production audit gate:
new high-severity findings affect `body-parser` and `multer`. Those findings were absent from the
failed CI evidence and remained outside that bounded repair. Remaining checks ran explicitly so their
results remained available.

Repair verification also passes `pnpm lint`, `pnpm knip`, `pnpm format:check`, `pnpm typecheck`,
all 350 unit tests and `pnpm build`. Integration, browser and image checks are not rerun locally
for this dependency patch; they passed in the source-SHA CI run. Fresh CI is not awaited.

CI repair attempt 2 on 2026-10-24 addresses the dependency audit behind the failed Delivery gate in
[run 40075170330](https://github.com/Shagon1k/PickFlick/actions/runs/40075170330), from authorized
source `526ce0dc525730d202c22ff001b416c7a225e734`. The lockfile selects the published
`body-parser@2.4.0` fix for [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)
within Express's range, plus its required `qs@6.16.1`. A Nest-adapter-scoped override selects
`multer@2.5.0` for [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m).
No application code or audit policy changes.

The frozen install and production audit pass; only 2 low and 5 moderate findings remain. Temporary
runtime checks pass for Express JSON, form and raw parsing, invalid JSON, gzip/deflate trailing bytes,
and the upstream Multer asynchronous file-filter teardown regression. All 9 focused backend tests
pass. Integration, browser and image checks are not rerun locally for this repair; those jobs passed
in the source-SHA CI run. Fresh CI is not awaited or retried.

`PICKFLICK_ENV_FILE=.env.example pnpm verify` passes the production audit, lint, Knip, formatting,
type checking, all 350 unit tests and every workspace build on Node 24.15.0 / pnpm 11.25.0.

Owner-approved review fix round 1 on 2026-10-24 starts from exact PR head
`75d9c7d84fee03e75d2d23b8a937dcbe40715618` and addresses only the
[retry-safety finding](https://github.com/Shagon1k/PickFlick/pull/186#discussion_r4366629536).
The form retains a UUID `submissionId` across retries; the API uses the existing Session primary
key to enforce uniqueness. Under the existing Club lock, current authorization and the creator's
SESSION_CREATED audit record gate replay of the saved result. Replays leave the committed evidence
unchanged. Keys belonging to another Club, creator or Session type return `SUBMISSION_CONFLICT`.
A new form uses a new key, so intentional repeat screenings remain separate records. No migration,
dependency or environment change is introduced.

The full integration suite passes all 231 tests across 25 files, including concurrent retries,
single roster/rating/audit persistence, intentional repeats, authorization and identifier conflicts.
The browser regression drops the response after the server commits, then retries the same form
and checks the original Session link, two attendees, one imported rating and one audit event.

`PICKFLICK_ENV_FILE=.env.example pnpm verify` passes the production audit, lint, Knip, formatting,
type checking, all 350 unit tests and every workspace build on Node 24.15.0 / pnpm 11.25.0.
The final browser run passes all 12 `pnpm test:journeys` checks, including the lost-response
regression, and all 54 `pnpm test:ui:smoke` checks. Focused lint and formatting also pass after
the new journey's setup correction. Visual baselines are unchanged. Local gitleaks is unavailable;
CI retains the secret-scanning gate. Fresh CI is not awaited, and exact-SHA hosted preview plus
owner visual acknowledgment remain required before acceptance.

Owner-approved review fix round 2 on 2026-10-24 starts from exact PR head
`a58159979d36b140645061ec0924ec252edab0c0` and addresses only the
[changed replay evidence finding](https://github.com/Shagon1k/PickFlick/pull/186#discussion_r4367194090).
Replays compare all supplied details and attendee scores with the saved record. Changed evidence
returns `SUBMISSION_MISMATCH`; the form retains the edits and explains that they were not saved.
Equivalent dates, normalized optional text and reordered attendees still replay successfully.
The existing Club lock, authorization and primary key continue to prevent duplicate Sessions,
attendees, ratings and audit events. No schema, dependency, environment or infrastructure change.

Round 2 verification passes on Node 24.15.0 / pnpm 11.25.0: full
`PICKFLICK_ENV_FILE=.env.example pnpm verify` (including all 350 unit tests and workspace builds),
all 233 integration tests across 25 files, all 12 real-API journeys and all 54 UI smoke checks.
The lost-response regression edits location, attendance and a score, checks the explicit mismatch
and retained entries, then restores the original evidence and recovers the saved Session.
Phone and desktop form captures were inspected; visual baselines are unchanged. Local gitleaks
remains unavailable. Fresh CI is not awaited; exact-SHA hosted preview and owner visual
acknowledgment remain required before acceptance.

Input-readiness repair on 2026-10-25 starts from `b369e9389e1f8739fd6f953a107996e59d8bb8ec`.
[CI run 40135900869](https://github.com/Shagon1k/PickFlick/actions/runs/40135900869)
failed because the form accepted a date before hydration. The first controlled update cleared it,
so client validation prevented the network-failure scenario from reaching submission. Delaying the
JavaScript chunks reproduced the same failure locally before the fix.

Past Session fields and submission now stay disabled until their handlers are attached, using the
existing invitation-readiness pattern. The journey holds the chunks, checks the disabled controls,
then checks the retained date after Movie selection, network-failure recovery and successful retry.
All 12 real-API journeys pass, including the lost-response replay checks and Past Session coverage
at 390/768/1024/1440px. This repair changes no schema, dependencies or backend rules.

The repair also passes `PICKFLICK_ENV_FILE=.env.test pnpm verify`, including all 350 unit tests
and workspace builds, and all 54 `pnpm test:ui:smoke` checks on Node 24.15.0 / pnpm 11.25.0.
Phone and desktop captures were inspected; visual baselines were not updated.

## Optional historical nominations and scores (#53)

Run `r_be07ac03afc80581eee2` uses managed branch
`PF-53_14-2-reconstruct-optional-historical-nominations`. It extends the existing import transaction,
Club settings snapshot, Movie picker and Completed detail. Bulk import and live winner resolution
remain out of scope.

Migration 29 adds imported nominations and sparse Selection scores. These relational records preserve
participant/Membership references without requiring a known nominator or complete live ballot.
Completed labels incomplete evidence, unknown scores and unknown original times explicitly. Imported
totals do not choose or rank the screened Movie. Existing result visibility applies. Canonical behavior
and interfaces are recorded in Roadmap, Design and Architecture.

Verification covers schema validation, snapshot ranges, atomic rejection, equivalent and changed
replays, database provenance/foreign keys/immutability, departed and anonymized participants, hidden
results and responsive keyboard/touch entry. The exact-SHA hosted preview and owner acknowledgment
remain required before issue or phase acceptance.

Local verification on 2026-10-24–25 uses Node 24.15.0 / pnpm 11.25.0 and the isolated, seeded
`pickflick_test` database on port 35432. All 29 migrations apply. `pnpm verify` passes the production
audit, lint, Knip, formatting, type checking, all 352 unit tests and every workspace build.
`pnpm test:integration` passes all 240 tests across 26 files, including seven new imported-Selection
checks. The full suite requires the deterministic seed; the first fresh-database attempt lacked it.

The initial responsive fixture tried to choose zero on a legacy 1–5 Club scale. The form correctly
offered 1–5; the fixture now explicitly uses 0–5. API validation separately checks both scale starts.
Interrupting that run temporarily left default journey listeners on 41740/42741 outside the subsequent
command's process namespace. The corrected run uses temporary copies of the journey configuration and
startup script on 41840/42841. Repository test configuration and timeouts are unchanged. The original
listeners were later verified released.

All 12 real-API journeys pass with that temporary configuration, including all four partial-import
viewports and existing live Nomination, Selection, Watching and Rating flows. The new checks cover
duplicate feedback, clearing scores to unknown, removing a nomination and returning focus, offline
retention, zero versus unknown totals, hidden evidence, no page overflow and axe. Phone and desktop
form/Completed captures in `test-results/past-{form,completed}-{viewport}.png` were inspected.
Visual baselines are unchanged.

`pnpm test:ui:smoke` passes all 54 checks, including shared Movie selection, Completed history,
live Selection, Watching and Rating regressions. Local gitleaks is unavailable; the existing commit
hook reports that limitation and CI retains the mandatory secret scan. Fresh CI and the required
exact-head hosted preview with owner acknowledgment remain pending.
