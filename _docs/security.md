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

| Directive                                                             | Meaning                                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `script-src 'self' 'nonce-…' 'strict-dynamic'`                        | A script runs only if it carries this request's nonce or a nonced script loaded it.                              |
| `style-src 'self' 'unsafe-inline'`                                    | Stylesheets from PickFlick plus inline `style` attributes, which React and Mantine set and a nonce cannot cover. |
| `img-src 'self' data: blob:`, `font-src 'self'`, `connect-src 'self'` | Images, fonts, and requests only from PickFlick.                                                                 |
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`          | No plugins, no foreign `<base>`, and forms submit only to PickFlick.                                             |
| `frame-ancestors 'none'`                                              | No site may embed PickFlick in a frame.                                                                          |

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

- CI fails on any high or critical advisory (`pnpm audit --audit-level high`).
- Dependabot opens weekly grouped updates for npm packages and GitHub Actions, skipping releases
  younger than a week.
- When a transitive dependency lags behind a fix, `overrides` in `pnpm-workspace.yaml` pins the
  fixed version until the parent catches up.
- The Dockerfile pins its base images by digest, and every install uses the locked
  `pnpm-lock.yaml`.

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
