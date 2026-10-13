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
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`                                   | No plugins, no foreign `<base>`, and forms submit only to PickFlick.                                             |
| `frame-ancestors 'none'`                                                                       | No site may embed PickFlick in a frame.                                                                          |

A new third-party script, image host, font, or API origin needs a change to
`contentSecurityPolicy()` in `apps/frontend/src/lib/security-headers.ts`, a matching test, and a
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
- Session invites require their exact target's active Membership before any preview fields or
  response IDs are returned. Invalid, expired, revoked and ineligible access all return the same
  detail-free denial. Accepting updates a SessionParticipant and never creates Membership.
  Session token material is omitted from pending rows and audit events; raw links appear only at
  creation and in the recipient link flow.

- Session progress SSE resolves the API-owned authentication session and Club Membership before
  every version signal. Revocation, expiry, suspension or membership departure stops the stream.
  Events expose only a version, with private/no-store caching and proxy buffering disabled; Movie
  and author visibility remain enforced by the authoritative Session detail projection.

See [Authentication and sessions](authentication.md#authorizing-a-request) for the flow.

## Input and output

- Every request body, query, and form value is parsed with a zod schema from
  `@pickflick/contracts` at the boundary (`ZodValidationPipe`); strict objects reject unknown
  fields.
- JSON and form bodies are capped at 100 KB. Club avatars accept only PNG, JPEG, or WebP up to
  512 KiB, and the service checks that the file's first bytes match the declared type before
  storing it.
- React escapes rendered text; nothing renders user input as HTML.

## Abuse limits

`@nestjs/throttler` allows 120 requests a minute per client and 5 Contact messages per 10 minutes.
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

- CI runs `pnpm security:audit` in the independent **Dependency security** job, required by the
  Delivery gate on every event. Local `pnpm verify` still includes the same audit. Raw full-workspace
  `pnpm audit --audit-level high --json`
  findings stay visible, and every high or critical advisory blocks except the single temporary
  owner-approved mitigation below. Registry/process failures and incomplete evidence fail closed.
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
is used. This does not retire or broaden the separate braces mitigation below.

On 2026-10-09, the [GitHub advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)
and npm registry confirmed `next@16.3.8` fixes Image Optimization SSRF. The frontend pins that
patch release, including its matching environment and SWC packages in the lockfile. Its Node and
peer requirements remain compatible with the installed stack. The app configures no
`images.remotePatterns`, so the advisory's exposure condition is absent; the full-workspace audit
still requires the fixed version.

### Temporary braces mitigation

Owner Alex approved a local mitigation and narrowly scoped residual-risk exception for
`GHSA-vfj7-8cjw-p6xm`, **only `braces@3.0.3`**, while upstream has no fixed release (GitHub advisory
and npm registry rechecked on 2026-10-04). This is not a claim that the advisory disappeared.
The exception expires at **2026-12-10 00:00:00 UTC**; it cannot silently renew. Any extension needs
fresh owner approval and review of current upstream evidence.

`patches/braces@3.0.3.patch` is applied through `pnpm-workspace.yaml` `patchedDependencies`.
The parser rejects more than 100 combined brace/parenthesis AST containers, including unclosed or
mixed nesting, before recursive walkers run. Escapes, quoted content and bracket literals do not
consume AST depth. Compile, expand and stringify also validate caller-supplied child-node ASTs
iteratively before walking or mutating them, rejecting excessive depth and child cycles. Validation
also caps visited and queued AST work at 200000 entries, so tiny shared graphs cannot cause exponential
validation and broad caller ASTs cannot allocate an unbounded validation stack. Parent/prev
backlinks are not traversed: this is not a general validator for arbitrary malformed AST objects.

`scripts/security/braces-exception.json` records the reason, exact advisory/package/version, expiry,
patch SHA-256 and hashes of every installed braces JavaScript source file. Before filtering any
finding, `scripts/security-audit.mjs` independently verifies the patch bytes, enumerates the installed
workspace dependency graph and virtual-store copies, checks package identity/source hashes, and
exercises the rejection behavior. Missing/tampered/unapplied patches, an unexpected version, unknown
high/critical advisories, missing high/critical findings, malformed JSON and unexpected process exits
all fail. The raw version-based audit still reports this high advisory; only the verified guarded
gate accepts the temporary exception. All other high/critical findings remain blocking, including
future advisories on braces. No production-only scope, package renaming, version spoofing or global
threshold relaxation is used.

Regression tests retain original 3.0.3 outputs for normal patterns, ranges, escapes, quotes, brackets
and malformed input, plus 100/101 depth boundaries, deeply nested/unclosed/mixed inputs, parsed and
caller-supplied ASTs, and audit/patch tampering failures. The compatibility fixture was captured from
original braces@3.0.3; it is not invented audit evidence.

**Residual risk:** rejected depth raises `SyntaxError`; callers must catch/translate it if patterns
are untrusted. Micromatch's parse/braces helpers and chokidar's glob expansion propagate the error;
the patch does not silently return a match. Existing repository callers are development tools
(Stylelint, ESLint presets and nodemon), with repository-owned patterns. Lint and full verification
exercise those actual callers. This does not prove that arbitrary future untrusted glob callers are
safe. Cartesian expansion volume, hostile AST parent backlinks and unrelated denial-of-service
mechanisms are outside this depth mitigation. Never expose these APIs to untrusted runtime input
without separate input/resource bounds and error handling.

`@pickflick/config` now contains environment validation and TypeScript presets, with only zod as a
runtime dependency. `@pickflick/eslint-config` is a root dev-only workspace dependency; all ESLint
plugins live in its devDependencies and resolve from that package during development. Production
backend deploy/prune does not include that package or its plugins. This separation reduces accidental
runtime tool inclusion; it does not replace full-workspace audit or claim every production dependency
is vulnerability-free.

**Retirement:** monitor the official advisory and upstream releases. When a reviewed fixed release
exists, upgrade all dependency paths, regenerate the lockfile, remove the local patch and this
exception together, and prove full audit, regressions, lint, production packaging and `pnpm verify`.
If the advisory disappears first, investigate rather than extending the exception automatically.
At expiry the gate blocks even if audit no longer reports the advisory, forcing explicit retirement.

## Infrastructure

- Only the frontend is published. The backend, PostgreSQL, and MinIO sit on the internal Compose
  network with no host ports.
- Dokploy is protected by Cloudflare Access; automation reaches it with a service token.
- Production promotion is off until the owner enables it (`PRODUCTION_DEPLOY_ENABLED`).

See [UAT operations](uat-operations.md) and [production operations](production-operations.md).

## Not built yet

- Error telemetry and alerts on security-relevant failures.
- Data export and account deletion that anonymizes shared history.
- HSTS `includeSubDomains` and `preload`.
- Apple Sign In, which stays off until the owner approves it.

## Club invitation links

Invitation tokens contain 32 random bytes and expire after seven days. The API stores only a
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

The backend downloads displayed detail posters from the five validated provider hosts into private
S3-compatible storage. Downloads reject redirects, stop after five seconds or 5 MiB, and accept
only PNG, JPEG and WebP signatures. Source URLs remain in internal catalog caches; API responses
contain opaque same-origin `/api/movies/images/:key` paths for detail posters. Search media, detail
backdrops and cast portraits are returned as null without image I/O. The authenticated image endpoint
serves stored bytes through the existing frontend API rewrite. CSP limits images to self, data
and blob sources. Missing or failed downloads become text placeholders; storage errors propagate.
Provider text is escaped by React; the response schema rejects provider image URLs and mismatched
Movie identities before rendering.

Trailers stay outbound YouTube links. The backend builds `links.imdb` from stored validated IMDb
identifiers; details responses expose no external identifiers.
Wikipedia links explicitly search an encoded title on the fixed English Wikipedia origin;
they do not assert a verified article correspondence. External detail links use
`noopener noreferrer`. Third-party scripts, frames and API connections remain disallowed.
