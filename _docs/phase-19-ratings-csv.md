# Phase 19 — Personal ratings CSV

Implementation and verification notes for [#66](https://github.com/Shagon1k/PickFlick/issues/66),
run `r_35c87d4b4d175a6d3a61`. Project 3 owns live status. Keep this document until Phase 19 closes.

## Scope and approach

Reuse the existing PersonalMovieRating composite key, Library module, authenticated API client,
Settings shell, shared buttons and table. Add a bounded version 1 CSV parser, preview, transactional
import and caller-only export. No migration, dependency, environment variable, provider lookup,
job, object storage or historical data change is added. The durable format and behavior live in
[Personal ratings CSV](ratings-csv.md).

The source references are `settings.html#panel-import-export`, its surrounding Settings layout,
the prototype Design contract, responsive baselines' Control page and canonical `DESIGN.md`.
`landing.html` supplies the navigation destination, not another import layout. Preserve the two
flat import/export cards and the sidebar-to-compact-navigation transition at 1024px. The fixture's
two-column title/rating format is superseded by #66's stable Movie mapping, versioning and
validation requirements. Extra explanatory copy and confirmation feedback serve those requirements.

The Roadmap entity catalog still proposes `DataExportJob` for CSV and GDPR archives. This
implementation generates CSV within the authenticated request; it does not implement that job
model. The GDPR archive job belongs to #67. Review this remaining architecture difference before
accepting Phase 19; the entity requirement is preserved.

## Verification and acceptance

- Parser fixtures cover quoting, UTF-8/BOM, line endings, formula handling, malformed content,
  duplicates, unknown columns, and byte/record/cell limits.
- Database/API checks cover preview without writes, complete validation feedback, direct-import
  rejection, caller isolation, empty/formula-safe export, unchanged metadata on retries, updates,
  catalog revalidation, strict queries, authentication, body limits and transaction rollback.
- Browser checks cover preview, confirmation/cancel, replacing a selected file, all-row errors,
  repeat import, private/empty downloads, offline and request failures, accessibility and overflow.
- A real-API browser journey covers export → changed-score preview → import → identical retry
  and another user's unchanged rating.
- Compare rendered canonical and application screens at 390 and 1440, inspect representative
  baselines, then run the affected UI selections in the pinned Linux image.
- Run `pnpm verify` and the relevant integration/journey checks before committing.

Exact-head hosted preview and owner visual acknowledgment remain required. Local screenshots,
CI and a Draft PR do not complete this acceptance criterion. Leave #66 open until the owner
acknowledges the preview; this is an explicit acceptance gate, not a reason to claim delivery done.

## Recorded evidence

- All 13 focused database/API checks pass on a fresh task-owned PostgreSQL database with the
  existing 45 migrations. This includes the seven existing Personal Ratings checks for immutable
  Session history as well as the six CSV checks.
- All six focused CSV browser checks pass in the pinned Playwright image. The initial opened
  mobile preview overflow was corrected; the regression now proves local table scrolling and no
  page overflow. Two new 390/1440 captures were compared with rendered canonical references and
  inspected; see [baseline review](ui-quality.md#personal-ratings-csv-baseline-review-2026-11-12).
- The full smoke/visual selection plus both additional CSV contract checks finished 245/247 with
  four workers. The existing two-client Nomination check timed out and the existing imported
  Completed mobile screenshot differed by 661 pixels. Both passed unchanged in a separate
  single-worker run (2/2), without updating their baselines or test source. The Nomination check
  has prior intermittent failures recorded in the Settings phase evidence. The combined command
  returned failure; the rerun does not establish a clean full-suite run. CI remains required.
- The real API browser journey passes (1/1) against the built frontend and backend with isolated
  PostgreSQL and Redis. Export contains the caller's score, import changes it, an identical retry
  preserves the complete saved row, and the peer's score stays unchanged.
- `pnpm verify` passes: dependency audit, lint, Knip, formatting, all workspace/test types,
  685 unit tests and both production builds. The audit reports two low and six moderate findings,
  with no high or critical findings. No dependency or lockfile changes are included.

GDPR archive, deletion, legal-copy approval, inactivity retention and Club ratings export remain
outside this issue.
