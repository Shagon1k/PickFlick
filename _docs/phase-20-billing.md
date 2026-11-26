# Phase 20 billing preparation

Working reference for [#70](https://github.com/Shagon1k/PickFlick/issues/70), [#71](https://github.com/Shagon1k/PickFlick/issues/71) and [#72](https://github.com/Shagon1k/PickFlick/issues/72). Project 3 owns live
status. [Roadmap](../ROADMAP.md#phase-20--subscription--entitlements--in-progress) owns phase
acceptance; [ADR-021](decisions/README.md#adr-021--use-stripe-managed-payments-through-a-billing-adapter)
holds the accepted integration boundary.

## Authorization and current evidence

On 2026-11-23 Alex authorized proposal/documentation work and selected explicit Club choice,
with new work restricted until a choice is made. He also confirmed €5 per month plus applicable
tax at checkout (tax-exclusive price). He then created the PickFlick account/sandbox and configured
its product and portal through the Dashboard. The screenshots reviewed below are configuration
evidence, not API or payment-test evidence. Alex subsequently approved ADR-021, the recovery
rules and the five-part verification/configuration handoff on 2026-11-23.

Alex performs sandbox configuration interactively; this document does not authorize agent access
to credentials, runtime billing code, migrations or dependent implementation. Live activation and
the eligibility review belong to #94.

Club access still uses fixture entitlements in `apps/backend/src/modules/clubs/access/club-tiers.ts`.
`club-access.ts` already separates new-work permission from existing participation, lifecycle and
member limits. Subscription is implemented in #71 below; BillingEvent and reconciliation are implemented in #72 below.
Reuse these boundaries in #73; do not build a second authorization mechanism.

## Downgrade comparison

All options preserve Club/Session history, existing Session participation and period-end cancellation.

| Option                                                                    | Benefit                                      | Cost and recovery                                                                                                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Explicit Admin choice                                                     | Keeps the Club the organizer actually wants. | Needs a selection control and server authorization. If the choice is missing at expiry, restrict new work until the Admin chooses.                                 |
| Deterministic default: oldest active administered Club, ID as tie-breaker | No action is required at expiry.             | Age does not establish importance. The default may exceed the member limit; an override or roster cleanup is still needed.                                         |
| Temporarily restrict every excess Club                                    | Avoids choosing on the Admin's behalf.       | Without a selection control, recovery requires reducing the active administered count to one or upgrading. This adds friction even when one Club fits Free limits. |

**Accepted approach:** explicit choice, with temporary restriction if no valid choice exists.
Alex approved the detailed recovery on 2026-11-23. The durable rules now live in the
[Roadmap](../ROADMAP.md#plans-and-limits). Implementation details for #73:

- With more than one active administered Club, the Admin may choose one before the paid period
  ends, and choose or change it after downgrade. Selection never shortens paid Pro access.
- At expiry, recheck active administration and lifecycle on the server. A missing or invalid choice
  restricts new Sessions, past Session imports and invitations in all excess Clubs until selection.
  Archived Clubs stay archived. With at most one active administered Club, no choice is needed.
- The selected Club still needs to meet the Free member limit of eight for new Sessions/imports.
  At eight members, existing participation and new Sessions remain available, but invitations do not.
  Choosing a Club never removes members or grants extra capacity.
- Preserve existing Session participation, history and permitted recovery actions such as member
  removal, leaving and archiving. Other lifecycle, membership and role checks still apply.
- Selection changes serialize with administered-Club checks using the existing Admin lock. At most
  one Club can become eligible for new work; selection alone never reactivates an archived Club.
- Restored paid Pro removes the downgrade restriction, subject to ordinary lifecycle and limits.
  An upgrade never deletes history or automatically reactivates archived Clubs.

### Verification cases for #73

Cover zero/one/multiple administered Clubs; choice before expiry; no choice; invalid or archived
choice; eight/nine members; changing choice concurrently with new work; paid-period expiry and
renewal; preserved participation/history; recovery without Pro; and rejected selection by anyone
other than the active Admin. Assert no history deletion and no second Club with new-work access.
These are future implementation checks, not tests run by this documentation change.

## Owner setup: PickFlick Stripe sandbox

Use the procedure below; confirmed progress is recorded in the evidence section. Record dated,
redacted confirmations; never put keys, signing secrets,
customer data or authenticated portal/Checkout URLs in this document, issues or chat.

1. In the Stripe Dashboard account picker, select **New account** and create **PickFlick** separately
   from TailorTales. Use the same Lithuanian legal business where appropriate. Alex confirmed that
   no TailorTales Stripe account exists yet. Owner-approved disposition: group the
   accounts under one [Stripe Organization](https://docs.stripe.com/get-started/account/orgs) when
   TailorTales creates its account; do not create that account solely for this task. Alex is the
   confirmed owner of PickFlick configuration and later live activation.
   See [multiple accounts](https://support.stripe.com/questions/create-and-manage-multiple-stripe-accounts).
2. Open the PickFlick sandbox created by onboarding (**PickFlick sandbox** in the reviewed
   Dashboard). If no sandbox exists, use **Switch to sandbox → Create sandbox**. Verify that the
   sandbox is selected before configuring products.
   See [sandbox management](https://docs.stripe.com/sandboxes/dashboard/manage).
3. Inside that sandbox, open **Settings → Product settings → Managed Payments** and review the
   displayed terms/pricing and enablement flow. Confirm that Managed Payments is available there.
   If Stripe requires live eligibility before sandbox use, record that exact blocker; do not silently
   switch to standard Stripe Payments. See [enablement](https://support.stripe.com/questions/get-started-with-stripe-managed-payments).
4. Create **PickFlick Pro**, one recurring EUR price of **500 cents per month**, quantity one.
   Use `txcd_10103000` (personal-use SaaS), as selected during the guided setup.
   Set tax behavior to **exclusive**: Alex confirmed €5 plus applicable tax at checkout on
   2026-11-23. No annual price, trial or custom coupon is proposed.
   See [product and price setup](https://docs.stripe.com/payments/managed-payments/set-up).
5. Configure the sandbox Customer Portal for payment-method updates, invoice access and
   cancellation at the end of the paid period. Disable plan/quantity changes outside the single
   Pro offer. Billing history in PickFlick links to provider invoice documents; do not generate
   separate PickFlick invoices. Verify actual portal behavior with #71.
6. Under #94, configure and verify the approved support inbox `hello@pick-flick.app` and statement
   descriptor `PICKFLICK`; Alex owns configuration and support. Review Link's customer-facing
   identity, refunds and support escalation behavior against the public copy. These fields are not
   available on the reviewed sandbox Business details page.
7. Coordinate the sandbox webhook destination with #72 after its route exists. Register the actual
   reachable HTTPS URL, record its subscribed events and API version, and verify signed delivery
   when the handler exists.
   Do not register a guessed endpoint. Local forwarding and hosted endpoints have separate signing
   secrets; keep each in its owning secure environment.

### Dashboard evidence reviewed — 2026-11-23

- The Dashboard identifies PickFlick and PickFlick sandbox. Alex confirmed that no TailorTales
  Stripe account has been created. Alex approved deferring Organization grouping until that
  account exists and confirmed ownership of PickFlick configuration and live activation.
- Managed Payments status is **Ready to use**, enabled by default for Checkout Sessions/payment
  links. The page reports no Managed Payments transactions/subscriptions; Active follows the first
  transaction. This does not establish live eligibility.
- PickFlick Pro is Active: EUR 5 per month, personal-use SaaS (`txcd_10103000`), eligible for
  Managed Payments. The saved price details show EUR 5, Monthly, Flat rate and no trial. The price
  editor showed **Use default (no)**; Alex then confirmed selecting explicit **No** and saving.
  The account tax setting is also **Include tax in price: No**. Checkout tax calculation is untested.
- Portal settings were reviewed and the configuration saved: period-end cancellation, payment-method
  updates and invoice/receipt access enabled; plan/quantity changes disabled. The saved header is
  `Manage your PickFlick Pro subscription`. Customer information permits name/email/billing-address
  updates; phone was instructed off. Actual customer flow and the persisted field flags remain untested.
- Business details are unavailable on the shown page, which requests product activation. Support
  email and statement descriptor remain unconfirmed; no live activation was performed.
- Alex approved **Refund without emailing me** on 2026-11-23: Stripe processes eligible refund
  requests without requesting approval by email. Public refund copy still needs review under #94.

### Accepted handoff and unverified evidence

| Work/evidence            | Owner-approved destination and current limit                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account and Organization | Alex owns PickFlick configuration/live activation. Organization grouping waits for the TailorTales account; it does not block #71–#73.                                                          |
| Monthly offer and portal | #71 verifies checkout tax calculation, first-payment anchor, saved portal flags and actual customer flow. Dashboard configuration and explicit tax-exclusive price setting are confirmed above. |
| Support and descriptor   | #94 installs/verifies `hello@pick-flick.app` and `PICKFLICK`, with Alex responsible; public-copy and live eligibility review stay there.                                                        |
| Webhook                  | #72 registers the agreed endpoint/events and proves signature/order/replay behavior. #71/#72 pin a compatible API/SDK version and install environment-specific signing secrets securely.        |
| Entitlements             | #73 implements and tests the accepted Roadmap downgrade/recovery policy.                                                                                                                        |
| Runtime configuration    | #71/#72 implement the accepted inventory in `.env.example`, typed startup validation and environment wiring. No values are copied into repository evidence.                                     |
| Decision                 | ADR-021 and the detailed recovery/handoff are accepted by Alex on 2026-11-23. Repository delivery is still pending.                                                                             |

Owner-approved staging: #70 approves the webhook destination/configuration contract;
#72 registers the reachable handler and proves delivery. Requiring an implemented #72 handler
before #70 can unblock #72 would create a dependency cycle. Account/product/portal readiness
remains required in #70; this staging does not waive signed-delivery acceptance in #72.

### Accepted webhook destination contract

Follow the existing `/webhooks/resend` controller convention and Next's `/api/:path*` rewrite:

- Backend route: `POST /webhooks/stripe`; public path: `POST /api/webhooks/stripe`.
- Sandbox hosted destination: `https://uat.pick-flick.app/api/webhooks/stripe`, registered only
  after #72 deploys the handler with owner-approved UAT setup. Local tests forward to the local
  backend route; no public production endpoint is activated by #70.
- Verify raw body bytes with `Stripe-Signature` inside the adapter before processing any event.
  Session auth does not authenticate a provider webhook; invalid signatures cannot mutate state.
- #71 pins a supported API/SDK version at least `2025-03-31.basil`; #72 uses that exact version
  for its destination and fixtures. The actual selected version and signing-secret installation
  remain #71/#72 implementation evidence, not completed configuration here.

Alex approved staging registration/version pinning/delivery under #71/#72 and business-details
configuration under #94. Current Dashboard restrictions do not prove support email or descriptor
readiness; approved targets are `hello@pick-flick.app` and `PICKFLICK`.
Checkout tax calculation, first-payment anchor and actual portal behavior are #71 sandbox checks;
duplicate/out-of-order processing is #72, and Club-limit enforcement is #73. None has been tested.

Proposed event set: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
`invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded` and
`charge.dispute.created`. #72 must confirm the set against implemented handlers, including
refund/dispute reconciliation; this list does not approve an automatic refund-access policy.
See [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

## Design and delivery boundaries

Canonical sources are `pricing.html`, the Subscription panel in `settings.html`, `app.html`,
the prototype design contract and responsive baselines. The superseded `settings-subscription.html`
study is not authoritative. Existing Paddle copy/payment-method fixtures do not define Stripe
behavior. No Club-choice control exists in those prototypes: #71/#73 need an owner-reviewed
interaction before implementing that addition, using the shared UI kit.

For UI delivery inspect both reference and implementation at 390 and 1440 pixels; check hierarchy,
mobile composition, keyboard/focus behavior, pending choice, read-only, error and recovery states.
#70 created no UI. #71 rendered comparison and evidence are recorded below.

## Preparation verification — 2026-11-23

- Prettier 3.8.3: all seven changed Markdown files pass.
- `git diff --check`: passed.
- All 16 new/changed local Markdown links and heading anchors resolve.
- Remaining Paddle mentions in the changed canonical documents explain supersession or prototype
  copy; no Paddle integration is planned. Prior ADR history is preserved.
- With Node 24.15.0 and pnpm 11.25.0, lint, Knip, repository formatting, typecheck and build pass.
  All 765 unit tests in 77 files pass.
- `pnpm verify` is blocked by the security audit: existing `effect@3.20.0`, pulled in through
  Prisma, has unaccepted High advisory
  [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw).
  The remaining checks were run separately; this does not make the verification gate pass.
  Dependency manifests, lockfile and audit exceptions are unchanged.
- No integration, UI or provider checks were run; billing runtime is not implemented here.
- Issue #70 reads succeed with approved network access. A fresh Project 3 read returned
  `INSUFFICIENT_SCOPES` for `read:project`; credentials/scopes and Project status were not changed.
  The last successful Project read during initialization showed In progress.
- Alex explicitly approved publishing the preparation update. The
  [progress comment](https://github.com/Shagon1k/PickFlick/issues/70#issuecomment-7098628733)
  records the earlier preparation stage. After Alex accepted the five-part decision and criteria
  transfer, #70/#71/#72/#73/#94 bodies were updated and read back exactly. #70 marks only the
  confirmed policy/sandbox/configuration criteria complete; ADR delivery remains unchecked. All
  five issues remain OPEN, and no Project status or native blocker relationships were changed.

The #70 product/architecture checkpoint is owner-accepted, including the explicit handoff of
unperformed checks. Repository delivery and tracker reconciliation remain separate from that
acceptance. Phase 20 stays In progress; this decision does not claim passing runtime checks or
authorize starting dependent runs, production activation or access to secrets.

## Dependency security follow-up — 2026-11-24

Alex authorized fixing the audit blocker in PR #212 without exceptions or CI changes.
Prisma's config package pins `effect@3.20.0`, so a scoped
`@prisma/config@7.10.0>effect` override selects the first patched release, `3.22.1`.
The lockfile changes only Effect's version/integrity and that override; Prisma and other
dependency versions stay unchanged. See the [dependency security reference](security.md#dependencies-and-supply-chain).

Frozen installation and Prisma client generation pass. The production security audit reports
zero High and zero Critical advisories; the previous Effect blocker is resolved.
Full `pnpm verify` passes on Node 24.15.0 / pnpm 11.25.0: audit, lint, Knip, formatting,
typecheck, all 765 unit tests in 77 files and build. Hosted CI remains a separate delivery gate.

## #71 implementation — 2026-11-25

The owner approved the implementation, Stripe SDK, minimal migration, account-deletion integration
and routine scoped commits/pushes in the managed continuation. This supersedes the earlier
preparation-only boundary for #71. He clarified that Pro belongs to a User: any registered User
may subscribe before creating a Club and manage their subscription regardless of Club roles.
The last preparation messages retained `human-control` and `preview-required`; owner visual
acknowledgment is still required. No new product or legal/privacy sign-off is inferred.

The owner selected one existing PickFlick sandbox for local, preview and UAT after the Dashboard
blocked additional sandboxes behind business verification. He confirmed saving separate keys for
each environment and the common monthly Price ID. All six transferred screenshots were reviewed
in source order: account restriction, key listing/unification notice, own-integration choice,
custom permissions, resource selector and final seven-permission review. They establish setup
history, not a successful runtime payment. No values or secret files were read or changed here.

### Delivered boundaries

- One provider-neutral billing module, Stripe SDK `23.2.0`, API `2026-11-18.endive`, and an injectable
  stub. Runtime omission disables billing; a partial configuration or nonproduction live key fails
  startup. The offer is verified before Checkout: active personal-use SaaS, €5 (500 euro cents), monthly,
  quantity one, tax-exclusive. Only the approved Managed Payments parameters are sent.
- One `Subscription` row per User with random durable customer/checkout identities. User locking
  serializes checkout and account deletion. Open attempts are reused; new attempts require provider
  expiry. Missing responses replay the same committed identity. After 23 hours, an unresolved
  request stops for operator reconciliation rather than risking another purchase after Stripe's
  minimum 24-hour idempotency retention. Do not delete or reset that row to retry.
- Self-only summary, checkout, portal and paginated invoice API. No request accepts provider/customer,
  price or redirect selectors. The server reads stored Checkout/Subscription references, verifies
  the configured price and paid invoice period, and never trusts browser return parameters.
- Pricing and Settings Subscription use the existing shells/UI kit. Tax and Link disclosures,
  unavailable/pending/overdue/paused/ended/cancellation, usage, invoice loading/empty/error/pagination,
  offline and refresh states are implemented. Provider receipts are not duplicated by PickFlick.
- Deletion seals account access immediately. Its existing durable worker expires open checkout and
  cancels the subscription before billing completes. A payment racing expiry is reconciled on retry;
  provider failure retains the job. Minimal provider identities and billing audit remain under the
  anonymized history User, with financial/audit retention and external provider deletion still gated.
  Own archives include stored billing state and audit actions without internal retry identifiers.

Canonical references: [Architecture](../ARCHITECTURE.md#billing-boundary-partial),
[environment](environment.md#billing-configuration), [Design](../DESIGN.md#subscription--partial),
[archive inventory](gdpr-archives.md#version-1-inventory), and [security](security.md#billing).
The SDK pin follows the [official release](https://github.com/stripe/stripe-node/releases/tag/v23.2.0);
Checkout follows [Managed Payments setup](https://docs.stripe.com/payments/managed-payments/set-up)
and its [unsupported parameters](https://docs.stripe.com/payments/managed-payments/update-checkout#remove-unsupported-parameters).

### Verification and remaining acceptance

- The exact migration replays on an isolated test PostgreSQL database; shared environments are untouched.
- `pnpm verify` passes: production dependency audit (zero High/Critical), ESLint/Stylelint,
  Knip, formatting, all package/root type checks, 775 unit tests in 78 files, and production builds.
  Later focused ESLint/Stylelint checks pass for the final cancellation guard, initial-history
  loading state and Subscription/Pricing composition.
- Focused PostgreSQL/API checks: 23 tests pass across billing (13), account deletion (8) and
  archives (2), including concurrency, lost responses, paid/unpaid state, cancellation failure/race,
  the bounded idempotency window and own-data export excluding peer/retry identifiers.
- `pnpm deploy:check` passes without deploying anything.
- The real-API billing browser journey passes with the injected test provider: a registered User
  without Clubs upgrades, returns to the confirmed plan, opens portal, and cannot expose billing
  to a second User. Production bootstrap never imports the test provider entrypoint.
- The pinned Playwright 1.63.0 noble image with Node 24.15.0 passes all 45 selected billing/public
  checks without retry, including keyboard/axe, offline/failure/retry, pagination, anonymous sign-in,
  forged/replayed returns and strict screenshots. Ten new/changed baselines were inspected: Free
  and Pro Subscription, Pricing and the factual draft Privacy/Terms updates, each at 390/1440.
- Direct reference/implementation review retained the plan inset, two-column/stacked usage,
  local table scrolling, portal/cancellation sections, shared chrome and tokens. It corrected the
  new CTA wrapper's width and left-aligned the empty history row; required tax/Link/anchor text
  supplements the prototype's superseded provider fixtures.
- One earlier selected run failed the existing Contact in-flight check because its 300ms response
  completed between assertions. The test now uses the existing request barrier; the final 45-check
  run passes with flaky-test rejection enabled. No product Contact behavior or gate was weakened.
- An ad hoc Prisma schema diff reports FK differences on ten existing tables. Comparing the same
  database against the original HEAD schema produces identical FK differences; neither new billing
  table has drift. Historical FK changes are outside #71 and were not applied.
- Canonical `pricing.html`, `settings.html` Subscription panel and responsive baselines were
  rendered and inspected at 390/1440 before implementation. The obsolete Subscription study and
  Paddle fixture behavior were not used as requirements.
- Real sandbox checkout/tax/first-payment anchor and actual portal behavior remain **unverified**.
  The continuation forbids secrets/billing operations; no provider resources were mutated.
- Hosted preview of the exact head SHA and the owner's acknowledgment remain **pending**. The
  continuation does not authorize deployment. Local screenshots do not satisfy this criterion.
- Webhooks/BillingEvent remain #72; Club entitlements/downgrade choice remain #73. Live activation,
  support/descriptor and eligibility remain #94. Financial/privacy and public-copy sign-offs stay
  open. Phase 20 and issue acceptance are not marked Done.

### Review fixes — 2026-11-25

- Checkout creation and deletion recovery share one pure request builder; retry-window checks,
  provider calls and transaction order are preserved. The lost-response deletion regression
  verifies identical request inputs and expiry of the original checkout.
- Successful subscription refresh resets invoice history to its first page, replacing cached
  pages even when billing availability and customer presence stay unchanged.
- Usage restores the canonical 28px counters, 6px bars and 16px card padding. The environment
  reference states the offer as €5 monthly (500 euro cents).
- Focused PostgreSQL/API checks pass: 24 tests across billing, account deletion and archives,
  using a disposable local `pickflick_test` database.
- `pnpm verify` passes, including the production dependency audit, lint, Knip, formatting,
  type checks, 775 unit tests and production builds.
- All 12 billing browser checks pass in the pinned Playwright image, including the unpaid-to-paid
  invoice transition after exhausting pagination. The four Subscription baselines were updated
  and inspected against canonical `settings.html` at 390/1440; only the usage metrics changed.
- The full smoke/visual selection with four workers reports 262 passed and one flaky check:
  `selection-outcome-visible` at 390px passes on retry after a 661-pixel film-metadata spacing
  difference. The flaky-test gate fails this run. The Selection implementation, baseline and
  screenshot tolerance are unchanged by this review fix.
- Single-worker diagnosis reports two passes and one failure, followed by five passes with the
  exact source frontend restored temporarily and five passes after restoring the reviewed fixes.
  The cause remains unconfirmed; the full-run flaky-test failure is retained as a verification
  limitation rather than changing Selection behavior or accepting a different baseline.

## #72 implementation — 2026-11-26

Run `r_348c5147daf2c3ed079b` is the owner-started autonomous #72 run on the managed branch.
Its authorization covers scoped repository implementation, commits, a normal branch push and one
Draft PR. External billing operations, permission changes, secret installation, deployment and merge
are excluded. The earlier preparation-only boundary does not authorize those external actions.

### Delivered boundaries

- Raw-byte `POST /webhooks/stripe`, exposed by the existing Next rewrite at
  `POST /api/webhooks/stripe`. The adapter verifies `Stripe-Signature` with a five-minute tolerance,
  checks API `2026-11-18.endive` and test/live mode, validates the boundary, and emits neutral events.
- One unique `(provider, providerEventId)` receipt per valid event. The ledger is the durable work
  queue: intake returns 204 after insertion without provider reads. No raw payload, signature,
  signing-secret value, address or card data is stored. Unsupported events are explicitly ignored.
- A five-second worker in the API process, using the existing Nest worker lifecycle, User lock,
  provider adapter and paid-period projection. It processes one event and one due account per cycle.
  Subscription re-fetches happen inside the User lock, so event order cannot overwrite newer truth.
- Projection, audit and Phase 17 billing notification effects are atomic. Failed attempts roll back
  those writes before recording a bounded failure and a one-minute retry. Notifications use the
  committed state-transition audit identity; unchanged refreshes produce no extra notification.
- Scheduled reconciliation persists last/next check times and failure/attempt metadata. A successful
  check schedules the next in 15 minutes. Logs expose backlog, lag, failures and repaired mismatches.
  The [operations reference](environment.md#billing-webhook-operations) explains inspection/retry.
- Refunds/disputes re-fetch Subscription truth without assuming immediate revocation. Disputes resolve
  payment ownership inside the adapter and need operator-approved Charges Read permission. Foreign
  sandbox customers and anonymized Users cannot gain access through reconciliation.
- Own-data archives include customer-scoped minimal ledger metadata. Retention and external provider
  deletion remain privacy gates. An unresolved Checkout response without a stored provider ID stays
  an explicit operator-repair case; background reconciliation never creates a purchase.

### Verification and remaining acceptance

- `pnpm verify` passes on Node 24.15.0 / pnpm 11.25.0: production dependency audit (zero
  High/Critical), ESLint/Stylelint, Knip, formatting, all type checks, 782 unit tests in 79 files,
  and production builds.
- The full 49-migration chain, including the additive ledger/reconciliation migration, replays on a
  fresh disposable PostgreSQL database. Shared databases are untouched.
- All 49 focused PostgreSQL/API tests pass across the billing worker (14), existing billing API (14),
  account deletion (8) and archives (13). They cover raw-body intake, duplicate and concurrent events,
  out-of-order convergence, Checkout completion, cancel/reversal, paid-through preservation, failed
  acknowledgement, transaction rollback, retry, drift repair, refund/dispute handling, anonymized
  accounts, own-ledger export isolation and real S3-compatible storage cleanup/download.
- All 59 focused adapter/configuration unit tests pass, including the 11 agreed event kinds,
  invalid/stale/modified signatures, wrong API version/live mode, ignored events and Charge ownership.
- `pnpm deploy:check` and `git diff --check` pass; nothing is deployed.
- All 263 selected smoke/visual checks pass in the digest-pinned Playwright 1.63.0 noble image
  with Node 24.15.0 / pnpm 11.25.0 and one worker. CI retry/flaky rejection stays enabled;
  no test retries or baseline changes occur. The shared configuration change selects both full
  PR UI selections, despite introducing no frontend source changes.
- Staged gitleaks 8.30.1 scanning finds no leaks. Disposable database/storage containers are removed;
  the browser container removes itself after completion. The managed worktree remains for review.

Test fixtures are synthetic and schema-derived; they do not satisfy the requested recorded Managed
Payments sandbox evidence. No UI behavior changes, design baselines or Club entitlement replacement
are included.

The actual destination must be registered only after its handler is deployed, with the agreed event
set and exact pinned API version. Destination-specific signing-secret installation, Charges Read
permission, real signed delivery, recorded/redacted replay/order fixtures and Link/portal
cancel-at-period-end/reversal delivery remain unverified. Those actions require an owner-controlled
external setup/deployment continuation. #72 must remain open across this partial implementation PR;
local tests and Draft PR creation do not close its post-deployment acceptance gate.

### Review fix round 1 — 2026-11-26

- Settings and both checkout refresh transactions now use `Transactions.write`, so new billing
  notifications publish recipient refresh signals after commit. Existing locks, timeouts and
  transaction order are preserved.
- Snapshot persistence and reconciliation share `hasSubscriptionChanged`; both callers retain
  their original arguments and evaluation points, including Checkout's intermediate state and
  date/null comparison semantics.
- All three new publication regressions fail on the source snapshot and pass with the fix.
  Separate database reads during publication confirm the projection and notification are committed.
  Unchanged Settings refreshes and subsequent worker reconciliation publish no duplicate signal.
- All 39 focused PostgreSQL/API checks pass across billing (17), reconciliation (14) and account
  deletion (8), including cancellation/reversal, scheduled repair and rollback cases. The existing
  migration chain replays on a fresh disposable local `pickflick_test` database; no schema changes
  are included.
- `pnpm verify` passes on Node 24.15.0 / pnpm 11.25.0: the dependency audit, lint, Knip,
  formatting, type checks, 782 unit tests and production builds. Staged gitleaks scanning and
  `git diff --check` pass. Disposable database/storage containers are removed.
