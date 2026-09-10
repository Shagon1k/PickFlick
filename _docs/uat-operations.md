# UAT provisioning and delivery

This how-to provisions PickFlick UAT and connects it to the exact-revision workflow. Alex performs
all GitHub settings, Dokploy, Cloudflare, DNS, and live-environment actions. Repository automation
never reads secret values back from Dokploy and logs only revision and status metadata.

## Security prerequisite

Use a maintained Dokploy release that addresses the published advisories relevant to authenticated
Compose and server operations. The implementation baseline reviewed for issue #15 is Dokploy
`v0.30.6`; do not connect an older instance without a separate security review. Record the exact
Dokploy version in the issue evidence. Keep Dokploy administration private and grant the workflow
API key only the access needed to read and deploy the UAT Compose resource.

See the official [Dokploy releases](https://github.com/Dokploy/dokploy/releases),
[Compose API reference](https://docs.dokploy.com/docs/api/reference-compose), and
[security advisories](https://github.com/Dokploy/dokploy/security/advisories) before provisioning.

## Configure GitHub

1. Allow GitHub Actions to create and update repository contents. The UAT workflow uses this access
   to create immutable `PF-uat-<full-SHA>` tags for automatic delivery and confirmed rollback.
   If a tag ruleset covers that namespace, allow creation by GitHub Actions but keep updates and
   deletion blocked.
2. Add repository variable `DOKPLOY_URL` with the HTTPS origin of the Dokploy instance. Do not
   include credentials, a path, query parameters, or a fragment.
3. Add repository variable `DOKPLOY_UAT_COMPOSE_ID` with the UAT Compose resource identifier.
4. Add repository secret `DOKPLOY_API_TOKEN` with a least-privilege Dokploy API key.
5. Protect the Dokploy API with Cloudflare Access, create a UAT deployment service token, and add
   its credentials as repository secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
6. Add repository variable `PLAYWRIGHT_BASE_URL` with the exact value
   `https://uat.pick-flick.app`.

Do not enable a second GitHub or Dokploy push trigger. `.github/workflows/deploy-uat.yml` is the
only deployment owner. After the `CI` workflow succeeds for a push to `main`, it confirms that
`main` still points to the triggering SHA, creates or verifies its immutable tag, asks Dokploy to
deploy that tag, waits for the same runtime SHA, and runs browser smoke checks. Runs share one
non-cancelling concurrency group.
Deployment controls and dependencies always come from the current trusted `main`; every selected
revision gets an immutable tag and Dokploy is pinned to that tag before it clones the application
source. Automatic runs stop if `main` advances before deployment; the newer successful CI run then
owns UAT. Manual rollback also uses the immutable tag without executing scripts from the older
revision.

## Provision Dokploy UAT

1. Create a dedicated PickFlick UAT project. Do not reuse the future production project.
2. Create UAT-only managed PostgreSQL and Redis resources. Disable their external ports.
3. Create the external application network named by `DOKPLOY_NETWORK`, then attach the Compose,
   PostgreSQL, Redis, MinIO, and Dokploy routing resources to that network.
4. Create a UAT-only MinIO bucket and application access key. Configure a domain-restricted Resend
   sending key and verified UAT sender. Use only synthetic data.
5. Create a Docker Compose resource with this immutable configuration:

| Setting | Value |
| --- | --- |
| Source | GitHub |
| Owner/repository | `Shagon1k/PickFlick` |
| Branch | `main` initially; the workflow pins `PF-uat-<full-SHA>` before deployment |
| Auto deploy | Off |
| Compose type | Docker Compose, not Stack |
| Compose path | `compose.deploy.yaml` |
| Isolated deployment | Off; the repository supplies the external UAT network |

Set the Dokploy custom command to this exact value. Dokploy prefixes the first command with
`docker`; the explicit second `docker` is required:

```text
compose -f compose.deploy.yaml --profile release run --build --rm release && docker compose -f compose.deploy.yaml --profile application up --build -d --wait --remove-orphans
```

The first command runs migrations and required seed work without touching the active application
containers. The second command runs only after the release container succeeds.

Add these names as environment-level variables in Dokploy. Keep their values in Dokploy or an
assigned external vault; never place them in GitHub, issue text, logs, or this repository:

- `DATABASE_URL`
- `DOKPLOY_NETWORK`
- `REDIS_URL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `STORAGE_ACCESS_KEY`
- `STORAGE_BUCKET`
- `STORAGE_ENDPOINT`
- `STORAGE_FORCE_PATH_STYLE`
- `STORAGE_REGION`
- `STORAGE_SECRET_KEY`

For UAT MinIO, set `STORAGE_ENDPOINT=https://storage-uat.pick-flick.app`,
`STORAGE_FORCE_PATH_STYLE=true`, and `STORAGE_REGION=us-east-1`. The region remains part of S3
request signing even though MinIO does not use it for physical placement. Use a dedicated bucket
and application credentials; do not give the application the MinIO root identity. Route only the
MinIO S3 API port `9000` through Dokploy and Cloudflare. Keep the console port private.

`RESEND_API_KEY` is server-only. Prefer a sending-only key restricted to the verified sender
domain. `RESEND_FROM` must use that domain. Startup validates both values, but readiness does not
call Resend or send a message.

The workflow owns the Compose resource's service-level environment text. It writes only
`APP_ENV=uat`, the selected `SOURCE_REVISION`, and references such as
`${{environment.DATABASE_URL}}`; it does not copy the referenced value.

For the Compose preview before the first workflow run, seed the service-level environment once
with the reference-only block below. Replace `<FULL_MAIN_SHA>` with a full 40-character commit SHA
from `main`; do not replace the environment references with their values. The workflow overwrites
this block with the selected deployment SHA before every deployment.

```dotenv
APP_ENV=uat
SOURCE_REVISION=<FULL_MAIN_SHA>
DATABASE_URL=${{environment.DATABASE_URL}}
DOKPLOY_NETWORK=${{environment.DOKPLOY_NETWORK}}
REDIS_URL=${{environment.REDIS_URL}}
RESEND_API_KEY=${{environment.RESEND_API_KEY}}
RESEND_FROM=${{environment.RESEND_FROM}}
STORAGE_ACCESS_KEY=${{environment.STORAGE_ACCESS_KEY}}
STORAGE_BUCKET=${{environment.STORAGE_BUCKET}}
STORAGE_ENDPOINT=${{environment.STORAGE_ENDPOINT}}
STORAGE_FORCE_PATH_STYLE=${{environment.STORAGE_FORCE_PATH_STYLE}}
STORAGE_REGION=${{environment.STORAGE_REGION}}
STORAGE_SECRET_KEY=${{environment.STORAGE_SECRET_KEY}}
```

Before the first deployment, use Dokploy's Compose preview. Confirm that only `release`, `api`,
`worker`, and `web` exist; none has a host-published port; and every service uses the intended UAT
network and alias.

## Configure ingress

Create one Dokploy domain route for `uat.pick-flick.app`:

| Service | Public path | Container port | Strip path |
| --- | --- | --- | --- |
| `web` | `/` | `3000` | Off |

Next.js rewrites `/api/*` to the environment-specific internal API alias, so the API service does
not need a public Dokploy domain. Enable HTTPS and the approved certificate in Dokploy. Add a
separate `storage-uat.pick-flick.app` route to the MinIO S3 API on container port `9000`; do not
expose its console. In Cloudflare, point both UAT hostnames at the Dokploy ingress, enable the
proxy, and use strict end-to-end TLS after the origin certificates are valid. Publish only the two
approved UAT hostnames through Dokploy ingress. Do not publish PostgreSQL, Redis, the MinIO console,
or raw application-container ports.

## Verify the first deployment

After this implementation reaches `main` and its `CI` delivery gate succeeds:

1. Open the `Deploy to UAT` workflow and record its triggering full SHA.
2. Confirm Dokploy records a new successful deployment for the selected immutable tag.
3. Confirm `https://uat.pick-flick.app/api/health/live` reports the full SHA and
   `https://uat.pick-flick.app/api/health/ready` reports every dependency as `up`.
4. Confirm Cloudflare serves a valid HTTPS chain and HTTP redirects to HTTPS.
5. Confirm the workflow's desktop and mobile Playwright smoke checks pass.
6. Download the `uat-preview-<SHA>` artifact, compare both screenshots with the live site, and
   acknowledge the exact-SHA preview on issue #15.
7. From outside the Dokploy host, confirm the managed PostgreSQL and Redis ports are unreachable.

Do not paste rendered Compose, environment output, connection URLs, tokens, or raw provider
responses into GitHub evidence. Record only resource names, revision identifiers, pass/fail status,
timestamps, and redacted screenshots or logs.

## Prove release failure preservation

1. Record the active SHA, container identifiers, liveness response, and readiness result.
2. Temporarily replace the UAT environment-level `DATABASE_URL` with a syntactically valid but
   unreachable synthetic internal target.
3. Manually dispatch `Deploy to UAT` for the active SHA with `confirm_rollback` enabled.
4. Confirm the release step fails before the application convergence command runs.
5. Confirm the previously active web, API, and worker container identifiers, SHA, and health remain
   unchanged.
6. Restore the original UAT `DATABASE_URL` in Dokploy without copying it elsewhere, then dispatch
   the active SHA again and confirm recovery.

This drill changes only UAT configuration. Never run it against production or real user data.

## Restore a known-good revision

Before rollback, inspect every migration applied after the target revision. Restore the older
application only when those migrations are backward compatible with it. Use a forward fix when a
schema or data change is not backward compatible.

1. Select a full, previously green SHA contained in `main` and supported by the current UAT schema.
2. Manually dispatch `Deploy to UAT`, enter the SHA, and enable `confirm_rollback`.
3. Confirm the workflow creates or verifies `PF-uat-<full-SHA>`, pins the Compose resource to that
   tag, and Dokploy creates a new deployment record.
4. Confirm liveness reports the requested full SHA, readiness passes, and both browser smokes pass.
5. Record the target SHA, schema-compatibility decision, deployment record, and smoke result.

The workflow never rolls back the database. If the target application cannot run against the
current schema, stop and prepare a reviewed forward migration or forward application fix.
