# Phase 3 — Public Site & System States

This temporary delivery plan coordinates the Phase 3 issues. `ROADMAP.md` owns phase scope and
acceptance. `DESIGN.md` and `_docs/design/prototypes` own visible and interaction behavior. GitHub
Project 3 owns live issue status.

## Owning issues

| Slice | Issue | Outcome |
| --- | --- | --- |
| 3.1 | [#20 — Confirm production contact and email sender identity](https://github.com/Shagon1k/PickFlick/issues/20) | Fix the public contact, sender, environment, and provider-ownership contract. |
| 3.2 | [#21 — Build the responsive Landing and Pricing experiences](https://github.com/Shagon1k/PickFlick/issues/21) | Deliver the public product story and pricing surfaces from the canonical designs. |
| 3.3 | [#22 — Deliver the Contact form and privacy-safe message handling](https://github.com/Shagon1k/PickFlick/issues/22) | Accept, retain, and deliver contact messages without losing safe input or exposing private data. |
| 3.4 | [#23 — Add public legal-entry routes and indexing metadata boundaries](https://github.com/Shagon1k/PickFlick/issues/23) | Publish provisional legal entry points and explicit public/private indexing behavior. |
| 3.5 | [#24 — Implement branded not-found and application-error recovery](https://github.com/Shagon1k/PickFlick/issues/24) | Add safe, branded recovery for missing routes and application failures. |

## Sequence and boundaries

1. Issue #20 fixes the identity and ownership contract before public copy, Contact delivery, and
   notification email depend on it.
2. Issue #21 implements Landing and Pricing against the Phase 2 public shell.
3. Issue #22 implements Contact storage and delivery with the approved public address.
4. Issue #23 adds legal-entry routes and public metadata without treating provisional legal copy as
   approved policy.
5. Issue #24 completes public recovery surfaces and their safe error boundaries.

Phase 3 does not implement authentication, billing checkout, final legal approval, production
provisioning, or the Phase 17 notification system. Each owning issue must still prove its own
behavior before the phase-level acceptance check can pass.

## Approved contact and sender contract

- Publish `hello@pick-flick.app` as the only public contact address. Google Workspace receives the
  address, and Alex owns the mailbox administration and recovery path.
- Send production application email as `PickFlick <notifications@pick-flick.app>` through Resend.
  Set `Reply-To` to `hello@pick-flick.app`, and route direct mail to the sender address into the same
  owner-controlled contact queue before production release.
- Send UAT application email as `PickFlick UAT <notifications@uat.pick-flick.app>` through a
  separate, domain-restricted UAT Resend key. UAT uses synthetic data and approved test recipients;
  it does not need a Google Workspace mailbox for the sender address.
- Keep local and test email disabled with the existing `example.invalid` identity.
- Alex owns the Cloudflare DNS zone, Google Workspace configuration, and Resend account. Do not
  place those resources under a contractor-owned account or record credentials in repository
  evidence.
- Do not fall back from Resend to personal SMTP, UAT credentials, or another environment. Preserve
  retryable intent and surface persistent delivery failure through the owning Contact or
  notification workflow.

The approved identity is a direction and configuration contract. Issue #20 does not authorize DNS,
Google Workspace, Resend, UAT, or production mutations.

## Affected-document map

| Artifact | Issue #20 impact |
| --- | --- |
| `ROADMAP.md` | Resolves the product decision, separates the remaining crawler-cache question, and records Phase 3 as in progress. |
| `DESIGN.md` | Resolves DES-009 and fixes the public and environment-specific visible identities. |
| `ARCHITECTURE.md` | Defines Google Workspace and Resend ownership, trust boundaries, and failure behavior. |
| `_docs/decisions/README.md` | Preserves the approved choice, alternatives, consequences, and later live-verification gate in ADR-009. |
| `_docs/environment.md` | Defines exact non-secret From values and environment isolation without adding a runtime variable. |
| `_docs/uat-operations.md` | Defines the UAT sender, key scope, recipient boundary, and prohibited fallbacks. |
| `_docs/production-operations.md` | Adds the production sender, reply path, ownership, authentication, and pre-release checks. |
| `_docs/README.md` | Links this active phase plan and includes ADR-009 in the decision inventory. |
| `_docs/design/prototypes/contact.html` | Already publishes `hello@pick-flick.app`; no change is required. |

Issue #20 changes no application code, secret file, checked-in environment value, DNS record, or
provider configuration.

## Inherited contracts

- Use the canonical `https://pick-flick.app` and `https://uat.pick-flick.app` origins.
- Treat prototype email strings as fixtures unless they match the approved identity above.
- Keep Contact submission privacy-safe: validate untrusted input, limit message length to 500
  characters, retain safe input across retryable failures, and do not log message bodies.
- Keep legal copy provisional until implementation and legal/privacy review agree.
- Index only approved public routes. Keep authenticated and token-bearing routes out of search
  indexes and public metadata.
- Preserve keyboard, touch, assistive-technology, responsive, reduced-motion, and recovery behavior
  from the canonical design contract.

## Edge cases

| Area | Required handling |
| --- | --- |
| Contact routing | Keep the public address stable when the underlying mailbox or responsible person changes; update private Google Workspace routing instead of publishing a personal address. |
| Sender replies | Use the public contact as `Reply-To`; direct mail to the sender address must not disappear before production release. |
| Environment isolation | UAT never uses the production key or sender, and production never falls back to UAT. |
| Provider failure | Persist retryable intent, bound retries, record delivery state, and alert on persistent failure without logging message content. |
| Authentication | Publish SPF and DKIM records required by each provider and stage DMARC from monitoring to enforcement only after every legitimate sender passes. |
| Test delivery | Use synthetic content and explicitly approved recipients; do not send UAT messages to product users. |

## Verification in progress

| Evidence | Command or source | Status |
| --- | --- | --- |
| Owner decision | Issue #20 human-control approval on 2026-09-13 | Passed: public contact, production sender, UAT sender, and Alex-owned provider boundaries approved. |
| DNS feasibility | Read-only public DNS inspection on 2026-09-13 | Passed: Cloudflare nameservers, Google root-domain mail routing, and distinct Resend production/UAT authentication records were present; DMARC was absent. This plan records no provider-generated values or credentials. |
| Provider feasibility | Resend domain, API-key, MX coexistence, and DMARC guidance; Google Workspace custom-domain guidance | Passed for the documented direction; live provider dashboard state was not inspected. |
| Documentation consistency | `git diff --check`, focused identity scan, relative-link check, and repository lint | Passed: diff and identity checks, 197 relative links across nine files, and `pnpm lint`. |
| Live mailbox and provider behavior | Google Workspace routing test, Resend dashboard verification, authenticated delivery, reply, SPF/DKIM/DMARC inspection | Owner-run and not authorized in issue #20. Required before dependent production release validation. |
| Landing and Pricing implementation | Issue #21 production routes, shared marketing content/styles, FAQ interaction, and corrected plan contract | Passed locally: `/` and `/pricing` prerender statically; the €5 monthly offer matches the Roadmap; both plans keep one blocking Session per Club; open Rating Sessions remain unlimited; Pro checkout is disabled until the Paddle phase. |
| Public-page quality gate | `pnpm ui:test`, focused plan-contract tests, source comparison, and production build | Passed locally: 94 Chromium checks include axe at 390/1440, overflow at seven widths, semantic comparison row headers, FAQ/focus/reduced-motion behavior, progressive landing reveals with a no-JavaScript fallback, the fixed public menu through 820px, the 576–767px composition bridge, local comparison-table scrolling, and eight reviewed S/M/L/XL page captures. |
| Contact implementation | Issue #22 Contact route, public API, PostgreSQL intent, and worker delivery reconciliation | Passed locally: server validation caps messages at 500 characters; keyed source hashes drive a serialized five-per-ten-minute limit; submission UUIDs make safe retries explicit duplicates; Resend delivery uses plain text, provider idempotency, bounded retries, and no body logging; successful delivery clears stored name, email, and message content. |
| Contact integration and UI quality | `pnpm contact:check`, `pnpm test`, `pnpm ui:test`, `pnpm db:check`, and production build | Passed locally: concurrent database submissions, duplicate/conflict handling, provider failure/retry exhaustion, log safety, stable validation/recovery feedback, input preservation, offline behavior, axe at 390/1440, overflow at seven widths, and four Contact S/M/L/XL captures. Exact-SHA preview and owner visual acknowledgment remain pending. |
| Contact review safeguards | Focused Vitest regressions, `pnpm verify`, `pnpm compose:check`, synthetic preview render, and `pnpm ui:test` | Passed locally: UAT smoke follows the landing heading/title contract; the production-shaped forwarded sequence resolves the visitor address; preview delivery remains disabled; exact UAT/production senders fail closed; 228 workspace tests and 104 Chromium checks pass. |
| Contact review fix round 4 | Focused API/config/worker tests, Contact browser interactions, and repository quality gates | Passed locally: Contact uses a reusable Next Server Action form-state pattern; API and worker responsibilities are split into focused files; Prisma performs fenced claims; terminal outcomes remove personal content; declared delivery modes fail closed; shutdown timing covers in-flight work. `pnpm verify` passed with 238 tests, `pnpm ui:test` passed 105 Chromium checks, and fresh `db:check`, `contact:check`, and `compose:check` passed. |
| Legal entry and indexing boundaries | `pnpm verify`, `pnpm ui:test`, production output inspection, runtime header/metadata probes, and focused Vitest assertions | Passed locally: Privacy and Terms prerender with visibly provisional copy; all five approved public routes expose production canonicals and social metadata; robots/sitemap list the intended boundaries; login, invitation, authenticated, admin, and internal preview routes inherit noindex behavior and receive `X-Robots-Tag`. The repository gate passed 245 tests, and the full browser gate passed 118 checks across accessibility, overflow, behavior, and 20 S/M/L/XL public-page captures. Exact-SHA preview and owner visual acknowledgement remain pending. |
| Not-found and application-error recovery | `pnpm verify`, focused failure-path Playwright, `pnpm ui:test`, and S/M/L/XL source-comparison captures | Passed locally: unmatched routes return 404 with branded public recovery; unexpected application failures expose fixed copy rather than error messages or digests; Next retry, Hub and public routes, focus, keyboard, touch, 44px targets, reduced motion, axe, and seven-width overflow checks pass. The repository gate passed 245 tests and the full browser gate passed 132 Chromium checks, including eight system-state captures. Exact-SHA preview and owner visual acknowledgement remain pending. |

At the Phase 3 boundary, move durable implementation facts into canonical guidance, record phase
evidence in `ROADMAP.md`, and delete this file plus its docs-map link.
