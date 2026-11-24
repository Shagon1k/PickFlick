# Phase 20 billing preparation

Working reference for [#70](https://github.com/Shagon1k/PickFlick/issues/70). Project 3 owns live
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

Current code uses fixture entitlements in `apps/backend/src/modules/clubs/access/club-tiers.ts`.
`club-access.ts` already separates new-work permission from existing participation, lifecycle and
member limits. Subscription and BillingEvent are planned entities, absent from the Prisma schema.
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
This change creates no UI and claims no rendered comparison.

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
