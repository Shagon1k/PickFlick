# Phase 4 — Authentication & Account Onboarding

This temporary delivery plan coordinates the Phase 4 issues. `ROADMAP.md` owns phase scope and
acceptance. `ARCHITECTURE.md` and ADR-002/ADR-010 own the trust boundary and accepted auth
implementation direction. `DESIGN.md` and `_docs/design/prototypes` own visible and interaction
behavior. GitHub Project 3 owns live issue status.

## Owning issues

| Slice | Issue | Outcome |
| --- | --- | --- |
| 4.1 | [#25 — Select the auth/session library and account-linking contract](https://github.com/Shagon1k/PickFlick/issues/25) | Better Auth selected at the API boundary; identity, conflict, callback, and session behavior fixed below. |
| 4.2 | [#26 — Implement Google OAuth, secure sessions, and return-to-intent](https://github.com/Shagon1k/PickFlick/issues/26) | Establish the Identity module, Google sign-in, database sessions, Login, and safe continuation. |
| 4.3 | [#27 — Add Sign in with Apple and safe identity linking](https://github.com/Shagon1k/PickFlick/issues/27) | Add Apple first-return/relay handling and explicit multi-provider linking without account takeover. |
| 4.4 | [#28 — Enforce authentication, suspension, revocation, and global roles at every boundary](https://github.com/Shagon1k/PickFlick/issues/28) | Apply the shared session resolver and global-role policy to REST, SSE, files, and sensitive actions. |

## Sequence and boundaries

1. Issue #25 fixes the library and provider/session contract before implementation adds schema or
   configuration.
2. Issue #26 integrates Better Auth into `apps/api`, creates the reviewed identity/session schema,
   and proves Google, session, CSRF, cookie, revocation, and return-to-intent behavior.
3. Issue #27 adds Apple to the same Identity module and proves explicit account linking and
   conflict recovery, including Apple relay and first-return fields.
4. Issue #28 applies one API-owned session resolver and authorization policy to every protected
   boundary. It must not introduce a second session representation.

Next.js renders Login and authenticated UI, starts same-origin auth actions, and may make
optimistic navigation decisions. It does not own OAuth callbacks, interpret session cookies, or
authorize access. NestJS and the Identity module remain authoritative even when a request bypasses
the UI.

Phase 4 does not implement Club membership, password authentication, anonymous sessions, profile
settings, account deletion, or production provider provisioning. Alex supplies provider
configuration through approved secret systems; repository evidence never records credentials.

## Accepted implementation contract

### Library and ownership

- Use the supported stable Better Auth line as the OAuth and session engine inside `apps/api`.
- Mount the Better Auth handler at the same-origin API boundary. Issue #26 must prove the narrow
  NestJS/Express raw-request integration before retaining it; do not move the handler into Next.js
  to avoid an API integration problem.
- Use the Better Auth Prisma adapter with the repository's existing Prisma client and PostgreSQL.
  Treat generated schema as input to a reviewed repository migration, never as authority to apply
  an unaudited migration.
- Keep email/password and unused plugins disabled. Add no managed Better Auth service or separate
  auth runtime.
- Configure database-backed OAuth state (`account.storeStateStrategy: "database"`), encrypted
  database OAuth tokens (`account.encryptOAuthTokens: true`), and no provider-account cookie.
- Pin the selected package versions in `package.json` and `pnpm-lock.yaml`. Apply supported-line
  updates through reviewed dependency changes, with accelerated handling for security fixes.

### Identity and persistence

- `User` remains the PickFlick product identity. Provider records and sessions belong to the
  Identity module and refer to `User` by ID.
- Identify an external account by the unique pair `(provider, providerSubject)`. Email is profile
  data and a conflict signal; it is never the external identity key.
- Add reviewed database constraints that prevent one provider identity from belonging to multiple
  Users and prevent duplicate provider rows for one identity.
- Create a new `User` and its first provider account in one transaction. Concurrent callbacks must
  resolve to one durable identity or a safe conflict, never duplicate Users.
- Request only sign-in scopes and do not request offline provider access without a later approved
  use case. Store only provider fields required for sign-in, revocation, or approved profile
  bootstrap. Encrypt any retained OAuth tokens through Better Auth and never return or log them.

### Sign-in, linking, and conflicts

| Situation | Required result |
| --- | --- |
| Known `(provider, providerSubject)` | Sign in the already linked User. Provider email changes never move the identity to another User. |
| New provider identity and no matching User email | Create one User and provider account transactionally from verified, allowed profile fields. |
| New provider identity but email already belongs to a User | Do not merge or sign in automatically. Return a safe `account_not_linked` recovery that asks the person to use an existing method, then link explicitly. |
| Signed-in User starts explicit linking | Require a fresh session, bind a one-time link intent to that User, and attach the returned provider identity only after callback validation. |
| Explicit Apple link returns a relay or different email | Permit the link because the authenticated link intent proves the target User; retain the existing User email and store the provider email only on the provider account. |
| Provider identity is already linked to another User | Deny without revealing the other User and never reassign the identity automatically. |
| Provider omits or marks the required email unverified for a new User | Deny account creation with a safe provider error. A known provider subject may still sign in its existing User. |
| User attempts to unlink their last provider identity | Deny. PickFlick must not leave an account with no supported sign-in method. |

Configure Better Auth with implicit linking disabled. Allow different provider emails only inside
the explicit, fresh-session linking workflow needed for Apple relay addresses. Do not expose a
generic email-match merge path. Trust only the configured Google and Apple providers for explicit
linking, keep `allowUnlinkingAll` false, and keep provider profile updates on link disabled.

For linking, a fresh session means the User authenticated with an already linked provider no more
than 15 minutes earlier. A stale session must reauthenticate before PickFlick creates the one-time
link intent. Completing the new provider flow proves the provider identity; it does not refresh the
authorization of the pre-existing PickFlick session.

Google and Apple profile names are bootstrap hints, not durable identity keys. Preserve Apple
name fields when supplied on the first authorized return; later Apple callbacks may omit them.
Issue #27 must not erase an existing display name merely because Apple does not resend it.

### Sessions and cookies

- Use database-backed sessions. Disable stateless sessions and the session cookie cache so
  revocation takes effect on the next protected request.
- Use a seven-day rolling expiry with a one-day refresh interval and a 15-minute `freshAge`. Do not
  add a remember-me or indefinite-session mode in Phase 4.
- Give the browser only an opaque session identifier. Production uses a host-only cookie whose
  name starts with `__Host-`, with `Secure`, `HttpOnly`, and `Path=/`; do not set `Domain`.
- Keep the durable session cookie `SameSite=Lax` unless provider/browser evidence requires a
  narrower documented change. A short-lived OAuth correlation cookie may use a different
  provider-compatible `SameSite` value only when callback tests prove the need; it remains
  host-only, `Secure`, `HttpOnly`, and bounded by the OAuth attempt lifetime.
- Rotate the session after successful authentication and privilege changes. Sign-out revokes the
  current session. Suspension and account deletion revoke every session for the User.
- Store session meaning server-side. Do not place provider tokens, roles, permissions, or session
  data in browser storage or a client-readable cookie.
- Resolve the User status and current authorization data at the API boundary. A valid session for a
  suspended or anonymized User does not authorize access.

### Callback, return, CSRF, and origin handling

- Validate exact provider callback URLs, OAuth `state`, OIDC `nonce`, and PKCE where the provider
  flow supports it. OAuth state and link intent are single-use and expire after a bounded flow.
- Keep Better Auth CSRF, Origin, redirect, and host checks enabled. Deny credentialed cross-origin
  browser requests; do not enable permissive CORS for auth endpoints.
- Protect non-auth API mutations with the explicit CSRF mechanism and Origin validation required
  by ADR-002. `SameSite` is defense in depth, not the only control.
- Represent return-to-intent as validated server-side state or a signed opaque reference. Accept
  only relative application paths from an allowlist of supported route families. Reject absolute,
  protocol-relative, malformed, expired, replayed, and unauthorized targets.
- Preserve Club invitation continuation without logging or exposing raw invitation URLs. A Session
  invitation remains private and does not create Club membership.
- Map provider denial, invalid callback, conflict, expiry, and temporary provider failure to stable
  safe error codes and recovery actions. Do not expose provider responses, tokens, stack traces, or
  account-existence details.

## Issue handoff

| Issue | Must implement or prove |
| --- | --- |
| #26 | Better Auth/Nest mount order; reviewed Prisma migration; Google provider; database sessions; cookie contract; CSRF/Origin rejection; sign-out and immediate revocation; safe return-to-intent; Login UI; no token leakage. |
| #27 | Apple provider and generated client-secret lifecycle; first-return name/email capture; relay email; explicit fresh-session linking; duplicate/conflict matrix; no implicit email merge or identity reassignment. |
| #28 | One reusable session resolver; deny-by-default guards for REST, SSE, and file authorization; `USER`/`APP_ADMIN`; suspension and revoke-all behavior; privacy-safe auth telemetry and abuse controls. |

Each provider issue adds its real configuration to `.env.example`, typed startup validation, and
`_docs/environment.md` in the same change. Local and CI use deterministic provider doubles; UAT
uses provider sandbox configuration. No issue may add a fallback credential or copy a provider
secret into fixtures, screenshots, logs, or pull-request evidence.

## Verification in progress

| Evidence | Command or source | Status |
| --- | --- | --- |
| Trust boundary | ADR-002 and issue #25 review | Passed: Alex reaffirmed API-owned auth; Next.js remains UI/presentation, not the session authority. |
| Library comparison | Better Auth, Auth.js, NestJS Passport, and SuperTokens official documentation | Passed: Better Auth best fits the accepted API-owned boundary without adding a separate auth service; alternatives and trade-offs are recorded in ADR-010. |
| Provider contract | Issue #25 human-control approval on 2026-09-16 | Passed: explicit linking, conflict, callback, cookie, revocation, and ownership behavior approved. |
| Better Auth/Nest/Prisma compatibility | Issue #26 focused integration, migration review, tests, and build | Pending implementation. |
| Google sandbox and Login | Issue #26 provider run, integration/E2E, preview, and log review | Pending implementation and owner provider configuration. |
| Apple and linking | Issue #27 provider run, conflict tests, preview, and log review | Pending implementation and owner provider configuration. |
| Boundary authorization | Issue #28 negative authorization, revocation, SSE/file, and security-log suites | Pending implementation. |

At the Phase 4 boundary, move durable implementation facts into canonical guidance, record phase
evidence in `ROADMAP.md`, and delete this file plus its docs-map link.
