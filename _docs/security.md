# Security

How PickFlick defends its pages, API, and data, and where each defense lives. Authentication has its
own page, [Authentication and sessions](authentication.md). The decisions behind this page are
[ADR-002](decisions/README.md#adr-002--keep-authentication-and-sessions-at-the-api-boundary),
[ADR-010](decisions/README.md#adr-010--use-better-auth-at-the-api-boundary), and
[ADR-015](decisions/README.md#adr-015--send-a-nonce-based-csp-and-security-headers-from-each-runtime).

## The short version

- The browser talks to one origin. Cloudflare and Traefik forward to the frontend, which proxies
  `/api/*` to a backend that has no public port.
- The backend decides everything: who you are, what you may do, and whether input is valid. The
  frontend never authorizes.
- Every response carries security headers, and every page runs scripts only with a per-request
  nonce.
- CI blocks leaked secrets, known high-severity vulnerabilities, and CSP violations.

## Response headers

Pages get their headers from the frontend: `proxy.ts` sets the CSP, and `next.config.ts` adds the
rest. Next.js does not add its headers to responses it proxies, so the backend sets its own in
`configureApplication`.

| Header                       | Pages                               | API                                          | What it prevents                                                                         |
| ---------------------------- | ----------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | Nonce policy (below)                | `default-src 'none'; frame-ancestors 'none'` | Injected scripts running, and other sites framing the page (clickjacking).               |
| `Strict-Transport-Security`  | `max-age=31536000`                  | Same                                         | A downgrade to plain HTTP: after one visit, the browser uses HTTPS for a year.           |
| `X-Content-Type-Options`     | `nosniff`                           | Same                                         | The browser guessing a type, such as running an uploaded image as a script.              |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`   | `no-referrer`                                | Leaking full URLs (Club IDs, invitation paths) to other sites; they see only the origin. |
| `Permissions-Policy`         | Camera, microphone, geolocation off | —                                            | Any script, including a compromised one, asking for those devices.                       |
| `Cross-Origin-Opener-Policy` | `same-origin`                       | —                                            | A page PickFlick opens, or that opens PickFlick, reaching into its window.               |
| `X-Powered-By`               | Not sent                            | Not sent                                     | Advertising the framework to scanners.                                                   |

The page CSP allows:

| Directive                                                                                      | Meaning                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `script-src 'self' 'nonce-…' 'strict-dynamic'`                                                 | A script runs only if it carries this request's nonce or a nonced script loaded it.                              |
| `style-src 'self' 'unsafe-inline'`                                                             | Stylesheets from PickFlick plus inline `style` attributes, which React and Mantine set and a nonce cannot cover. |
| `img-src 'self' data: blob:` plus catalog CDN origins; `font-src 'self'`, `connect-src 'self'` | Images from PickFlick and the catalog allowlist; fonts and API requests stay same-origin.                        |
| `frame-src https://www.youtube-nocookie.com`                                                   | Trailers only, in YouTube's privacy-enhanced player, which the page loads after the viewer presses Play.         |
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`                                   | No plugins, no foreign `<base>`, and forms submit only to PickFlick.                                             |
| `frame-ancestors 'none'`                                                                       | No site may embed PickFlick in a frame.                                                                          |

A new third-party script, image host, font, or API origin needs a change to
`buildContentSecurityPolicy()` in `apps/frontend/src/lib/security-headers.ts`, a matching test, and a
review of what the new origin can do. The Playwright suite fails on any CSP violation, and
`instrumentation-client.ts` switches off zod's `eval` probe so the policy stays clean.

HSTS has no `includeSubDomains` or `preload` yet: both are hard to undo, so they wait until every
subdomain is known to serve HTTPS.

## Cross-site requests

A forged request from another site needs the session cookie, and several layers keep it out:

- The session cookie is `SameSite=Lax` and host-only (`__Host-` in UAT and production), so the
  browser does not attach it to cross-site `POST` requests.
- Better Auth accepts sign-in requests only from `AUTH_BASE_URL` (`trustedOrigins`).
- Next.js server actions accept only `POST` and reject a request whose `Origin` differs from its
  host.
- The backend enables no cross-origin resource sharing, so other sites cannot read its responses.

## Access control

- Every backend route requires a session unless it is marked `@Public()`; the guard is global.
- Club rules are re-read from the database on every request. A Club you are not an active member of
  answers `404`, so its existence does not leak.
- App Admin grants no Club rights.
- Shared Session URLs require current Club Membership to disclose details. Joining additionally
  requires an active Club and an open Session; operator removal blocks self-join. Responses lock
  Club → Session, affect only the caller's participant row, and never create Membership. Pending
  rows derive only from the caller's active Club Memberships and open, unanswered Sessions.
- Existing personalized Session invites require their exact target's active Membership before any preview fields or
  response IDs are returned. Invalid, expired, revoked and ineligible access all return the same
  detail-free denial. Accepting updates a SessionParticipant and never creates Membership.
  Session token material is omitted from pending rows and audit events; raw links appear only at
  creation and in the recipient link flow.

- Session progress is a polled, authenticated request that checks Club Membership each time and
  returns only a version with private/no-store caching. Revocation, expiry, suspension or departure
  denies the next poll; Movie and author visibility remain enforced by the authoritative Session
  detail projection.

- Notification list, cursors and read mutations are scoped to the authenticated recipient and
  in-app channel. Inbox projection rechecks current entity access; inaccessible or deleted targets
  reveal no entity link or copied content. The notification SSE connection rechecks its original
  session before each refresh signal and thirty-second heartbeat, terminates on revocation or identity change, and sends no
  entity payload. Redis carries only recipient UUID invalidation after database commits;
  it holds no notification content. Heartbeats never trigger inbox REST refreshes. REST responses are private/no-store; streams also disable transformation and
  proxy buffering. File and entity endpoints independently authorize every follow-up request.

See [Authentication and sessions](authentication.md#authorizing-a-request) for the flow.

## Input and output

- Every request body, query, and form value is parsed with a zod schema from
  `@pickflick/contracts` at the boundary (`ZodValidationPipe`); strict objects reject unknown
  fields.
- JSON and form bodies are capped at 100 KB. Club avatars accept only PNG, JPEG, or WebP up to
  512 KiB, and the service checks that the file's first bytes match the declared type before
  storing it.
- React escapes rendered text; nothing renders user input as HTML.

Notification delivery callbacks at `POST /api/webhooks/resend` are public to Resend, with raw-body
signature verification through its SDK before parsing provider data. Missing, invalid, stale or
modified signatures fail. Persisted receipt IDs make replayed callbacks idempotent. Only provider
IDs or signed notification tags matching a stored recipient-address hash can change delivery state.
Logs redact the signature header and omit provider messages, addresses and email bodies. Email jobs
persist typed source references and request/address hashes, never rendered content or invitation tokens.

## Abuse limits

`@nestjs/throttler` allows 120 requests a minute per client, 5 Contact messages per 10 minutes, and
600 Session progress or notification inbox checks a minute, because every open product page checks
for updates and a watch party often
shares one address.
Better Auth allows 60 requests a minute on its routes and 10 for social sign-in. The backend finds
the client address by trusting exactly two proxy hops (the frontend rewrite and the Cloudflare
entry), so a client cannot spoof it with its own `X-Forwarded-For`.

## Secrets

- Runtime secrets live in GitHub environment secrets and Dokploy, never in the repository.
  `.env.example` holds synthetic values only.
- Startup validation rejects a missing or malformed variable and names only the variable, never
  its value.
- Logs redact cookies, `Authorization`, and `Set-Cookie`, and never record message bodies.
- gitleaks scans staged changes in the pre-commit hook and the full history in CI.

## Dependencies and supply chain

- CI runs `pnpm security:audit` (`pnpm audit --prod --audit-level high`) in the independent
  **Dependency security** job, required by the Delivery gate on every event; local `pnpm verify`
  runs it too. Any high or critical advisory in a production dependency blocks. Development-only
  advisories stay visible through Dependabot and `pnpm audit` without blocking delivery.
- Dependabot opens weekly grouped updates for npm packages and GitHub Actions, skipping releases
  younger than a week.
- Prefer narrow lockfile updates within the parent's declared range for transitive fixes. When that
  range cannot accept a fix, `overrides` in `pnpm-workspace.yaml` pins a reviewed compatible version
  until the parent catches up.
- The Dockerfile pins its base images by digest, and every install uses the locked
  `pnpm-lock.yaml`.

On 2026-10-06, the official GitHub advisories and npm registry confirmed patched releases for
`source-map-js` (`GHSA-68fv-2mgg-jv7q`, 1.2.2), `proxy-addr` (`GHSA-jqcg-44mw-7w3h`, 2.0.8),
and `sharp` (`GHSA-wq5f-xc86-pv6w`, 0.35.5). The lockfile resolves those versions within existing
parent ranges, including sharp's matching optional native packages; no new override or exception
is used.

On 2026-10-09, the [GitHub advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)
and npm registry confirmed `next@16.3.8` fixes Image Optimization SSRF. The frontend pins that
patch release, including its matching environment and SWC packages in the lockfile. Its Node and
peer requirements remain compatible with the installed stack. The app configures no
`images.remotePatterns`, so the advisory's exposure condition is absent; the production audit
still requires the fixed version.

On 2026-10-23, the [GitHub advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) and two
related Next.js advisories (critical remote code execution and a high App Router denial of service)
covered `next` 16.0.0 to 16.4.0. The frontend pins `next@16.4.2`, which the production audit
accepts; `better-auth` resolves the same release.

On 2026-10-24, the [GitHub advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) and
npm registry confirmed `zod@4.6.6` fixes the constrained-collection memory exhaustion reported
by PR #186's dependency audit. The shared catalog and all lockfile references use that patch,
within existing consumer ranges. No override or audit exception is needed.

On 2026-10-24, PR #186's next dependency audit reported denial-of-service advisories in
[body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828) and
[Multer](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). The npm registry and upstream releases
confirm fixes in `body-parser@2.4.0` and `multer@2.5.0`. The lockfile updates body-parser within
Express 5.2.1's declared range, including its required `qs@6.16.1`. Nest's Express adapter pins
Multer 2.4.0, so an override scoped to `@nestjs/platform-express@12.1.0>multer` selects 2.5.0,
which retains the same dependencies and Node requirement. Remove that override when the adapter
includes a fixed version. Application parser settings and the audit policy are unchanged.

On 2026-10-27, the official GitHub advisories
[GHSA-965c-763c-88jm](https://github.com/advisories/GHSA-965c-763c-88jm) (critical OAuth state
sign-in bypass) and [GHSA-r4xp-prcw-77qf](https://github.com/advisories/GHSA-r4xp-prcw-77qf)
(high OAuth Proxy sign-in bypass), together with the npm registry, confirmed `better-auth@1.7.7`
as the first patched release. The shared client/server catalog, direct Prisma adapter, and
versioned Better Auth core, adapters and telemetry resolve to 1.7.7. Authentication configuration,
endpoint restrictions and the production high/critical audit gate are unchanged; no exception
or override is added. Database-backed OAuth state now uses the `auth-state:` namespace. A sign-in
started before the upgrade may need to be restarted after rollout; persisted sessions are unchanged.

### Retired braces mitigation

`braces@3.0.3` (`GHSA-vfj7-8cjw-p6xm`, no upstream fix) is reachable only through development
tools (Stylelint, ESLint presets and nodemon) that expand repository-owned glob patterns. The local
patch, its hash-verifying audit wrapper and the time-boxed exception were removed in #172 when the
gate moved to production dependencies, by owner decision. Never expose glob expansion to untrusted
runtime input without separate input and resource bounds.

`@pickflick/config` now contains environment validation and TypeScript presets, with only zod as a
runtime dependency. `@pickflick/eslint-config` is a root dev-only workspace dependency; all ESLint
plugins live in its devDependencies and resolve from that package during development. Production
backend deploy/prune does not include that package or its plugins. This separation reduces accidental
runtime tool inclusion; it does not replace full-workspace audit or claim every production dependency
is vulnerability-free.

## Infrastructure

- Only the frontend has public application routing; application Compose publishes no host ports.
  Backend and worker retain Dokploy's shared network for existing external connections. Managed
  PostgreSQL and MinIO must keep their data ports private; the shared network is not cross-project
  isolation.
- Signal-only Redis attaches exclusively to the project-scoped, `internal: true`
  `notification-signals` network, shared only with backend and worker. It has no published port,
  route or configured persistent volume, and never joins `dokploy-network`. This isolates the
  unauthenticated broker from other projects on that shared network, not from the Docker host
  administrator or a compromised backend/worker.
- Dokploy is protected by Cloudflare Access; automation reaches it with a service token.
- Production promotion is off until the owner enables it (`PRODUCTION_DEPLOY_ENABLED`).

See [UAT operations](uat-operations.md) and [production operations](production-operations.md).

## Not built yet

- Error telemetry and alerts on security-relevant failures.
- Data export and account deletion that anonymizes shared history.
- HSTS `includeSubDomains` and `preload`.
- Apple Sign In activation; its gated adapter exists and stays off until the owner approves it.
- Periodic abandoned-object cleanup, owned by release retention work in #87.
- Owner confirmation of repository-level Dependabot security-update enablement before release readiness;
  the committed weekly-update configuration does not prove that account setting.

## Club invitation links

Club invitation tokens contain 32 random bytes; new links expire after 12 hours. Existing links
retain their stored expiry, and legacy personalized Session tokens keep their seven-day lifetime. The API stores only a
SHA-256 digest; it returns the token once to the authorized Admin or Moderator creating the link.
Preview and response require authentication, validate the optional recipient, and reveal no Club
data for unsafe states. Accept, decline, and revoke serialize on the Club row; acceptance checks
member capacity and writes the Membership, audit event, and invitation response atomically.

Tokens travel in POST bodies to fixed API paths. HTTP logging omits request URLs, referrers, and
redirect locations as well as authentication headers. Invitation pages send `no-referrer`, private
no-store responses, and noindex metadata. The UI holds a newly created link in component state for
copying; it never persists it in browser storage. Recent-invitation API responses contain no token
or digest. Better Auth's short-lived OAuth state retains the allowlisted return path during sign-in;
provider log messages and error arguments are omitted to keep that path out of logs.

## Catalog media and outbound links

The backend downloads displayed posters from the five validated provider hosts into private
S3-compatible storage. Downloads reject redirects, stop after five seconds or 5 MiB, and accept
only PNG, JPEG and WebP signatures. Source URLs remain in internal catalog caches; API responses
contain opaque same-origin `/api/movies/images/:key` paths for detail posters. Search returns lazy
`/api/movies/:movieId/poster` URLs, resolving the configured validated details cache first, then validated private search caches
for the active source and redirecting to an ingested same-origin image. Search JSON never waits for downloads;
its image endpoint makes no provider metadata requests. Detail backdrops and cast portraits remain
null. The authenticated image endpoint
serves stored bytes through the existing frontend API rewrite. CSP limits images to self, data
and blob sources. Missing or failed downloads become text placeholders; storage errors propagate.
Provider text is escaped by React. Provider records are validated once, when the backend ingests
them; the web app trusts the API's contract types and does not re-validate its responses.
Yandex mirror URLs under `/get-kinopoisk-image/` normalize to the existing canonical
`avatars.mds.yandex.net` host before the full image URL validation. No new host is allowlisted.
Other unsupported optional PoiskKino image URLs are omitted before caching or image ingestion, so the
existing placeholder is shown without rejecting the Movie. The media host allowlist is unchanged.

Trailers play in YouTube's privacy-enhanced player: the page loads
`https://www.youtube-nocookie.com/embed/<id>` only after the viewer presses Play, from a video ID the
trailer contract has already validated, and the CSP allows that one frame origin. The backend
builds `links.imdb`, `links.kinopoisk` (a PoiskKino ID is the Kinopoisk film ID) and
`links.letterboxd` (from the IMDb, else the TMDB, ID) from stored validated identifiers; details
responses expose no external identifiers. Wikipedia links explicitly search an encoded title on the
fixed English Wikipedia origin; they do not assert a verified article correspondence. External detail
links use `noopener noreferrer`. Third-party scripts and API connections remain disallowed.
