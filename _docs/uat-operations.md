# UAT provisioning and delivery

How to provision `https://uat.pick-flick.app` and how automatic delivery works once it exists.
Alex performs every GitHub, Dokploy, Cloudflare, and DNS action. Automation never reads, writes, or
renders the Compose resource's environment.

Before you start, run a maintained Dokploy release that fixes the published advisories for
authenticated Compose and server operations, and keep Dokploy administration private. See the
[Dokploy releases](https://github.com/Dokploy/dokploy/releases),
[Compose API reference](https://docs.dokploy.com/docs/api/reference-compose), and
[security advisories](https://github.com/Dokploy/dokploy/security/advisories).

## How delivery works

After CI passes on a push to `main`, `deploy-uat.yml`:

1. Checks out the triggering SHA and stops if `main` has moved on.
2. Checks that the Dokploy Compose resource matches the settings below and is not already deploying.
3. Starts one deployment and waits for Dokploy to finish it.
4. Waits until `/api/health/live` reports that SHA and `/api/health/ready` reports every dependency
   up.
5. Runs the desktop and mobile Playwright smoke (`pnpm uat:smoke`) and uploads its screenshots.

The workflow never creates tags, changes the Compose branch, or touches the environment. The job is
named `UAT E2E`; production promotion requires it to have passed for the release revision.

## Configure GitHub

1. Add the Actions variable `DOKPLOY_URL`: the HTTPS Dokploy origin with no credentials, path,
   query, or fragment.
2. Add the Actions variable `DOKPLOY_UAT_COMPOSE_ID`: the UAT Compose resource ID.
3. Add the secret `DOKPLOY_API_TOKEN` with read and deploy access to that resource only.
4. Protect Dokploy with Cloudflare Access and add the service token as the secrets
   `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.

## Provision Dokploy

1. Create a PickFlick UAT project with a UAT-only managed PostgreSQL resource. Disable its external
   port.
2. Attach the Compose resource and PostgreSQL to Dokploy's shared `dokploy-network`.
   `compose.deploy.yaml` fixes that name; do not add a network variable.
3. Create a UAT-only MinIO bucket and an application access key (not the MinIO root identity).
4. Create a Resend sending-only key restricted to `uat.pick-flick.app` and verify the sender
   `PickFlick UAT <notifications@uat.pick-flick.app>`.
5. Create a Google OAuth web client for UAT only. Its one redirect URI is
   `https://uat.pick-flick.app/api/auth/callback/google`; leave JavaScript origins empty.
6. Create the Compose resource with these settings:

| Setting             | Value                     |
| ------------------- | ------------------------- |
| Source              | GitHub                    |
| Repository          | `Shagon1k/PickFlick`      |
| Branch              | `main`                    |
| Auto deploy         | Off                       |
| Compose type        | Docker Compose, not Stack |
| Compose path        | `compose.deploy.yaml`     |
| Isolated deployment | Off                       |
| Custom command      | Empty                     |

7. Enter the runtime values in the resource's **Environment** editor. This block is the source of
   truth; CI never replaces it. At minimum:

```text
APP_ENV=uat
AUTH_BASE_URL=https://uat.pick-flick.app
AUTH_SECRET
APPLE_SIGN_IN_ENABLED=false
CONTACT_DELIVERY_TO
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
RESEND_FROM="PickFlick UAT <notifications@uat.pick-flick.app>"
STORAGE_ENDPOINT=https://storage-uat.pick-flick.app
STORAGE_FORCE_PATH_STYLE=true
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
STORAGE_BUCKET
```

8. Open Dokploy's Compose preview and confirm that only `release`, `backend`, and `frontend` exist
   and none publishes a host port. Do not save the preview; it contains secrets.

Rules for these values:

- Set `CONTACT_DELIVERY_TO` to one approved test inbox and send only synthetic content.
- Never reuse production or preview keys, senders, or OAuth clients, and never fall back to personal
  SMTP. UAT needs no Google Workspace mailbox for its sender.
- Keep `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, and (later) `APPLE_PRIVATE_KEY` only in Dokploy's
  secret environment.
- Keep Apple disabled. After the owner approves Apple Developer Program membership and a sandbox
  run, use a UAT-only Services ID and key, register `https://uat.pick-flick.app` and
  `https://uat.pick-flick.app/api/auth/callback/apple`, set `APPLE_SIGN_IN_ENABLED=true`, and enter
  the `.p8` key as PKCS#8 PEM (`\n` line breaks are accepted).

## Configure ingress

1. Route `uat.pick-flick.app` to `frontend:3000`. The frontend rewrites `/api/*` to the private
   backend alias, so the backend has no public domain.
2. Route `storage-uat.pick-flick.app` to MinIO's S3 API port `9000`. Keep the console, PostgreSQL,
   and raw application ports private.

The backend trusts two proxy hops (the frontend rewrite and the Cloudflare entry) to find the
visitor's address for rate limiting. That only holds while this ingress path is the only public one.

## Verify the first deployment

If the workflow is disabled in GitHub Actions, enable it, then push to `main` or run it by hand.

1. Record the triggering SHA and the new Dokploy deployment record.
2. Confirm `https://uat.pick-flick.app/api/health/live` reports that SHA and
   `https://uat.pick-flick.app/api/health/ready` reports every dependency up.
3. Confirm valid HTTPS and the HTTP-to-HTTPS redirect.
4. Confirm the desktop and mobile smoke passed and the uploaded screenshots match live UAT.
5. From outside the Dokploy host, confirm the PostgreSQL port is unreachable.

## Recover a failed release

A failed `release` job keeps the new `backend` and `frontend` from starting, but Dokploy may already
have replaced containers, so the previous runtime is not guaranteed to survive. Fix the cause (often
the environment), then run an approved deployment. Never paste environment values, connection URLs,
tokens, or raw provider responses into evidence.
