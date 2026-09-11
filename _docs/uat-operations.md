# UAT provisioning and delivery

This runbook provisions PickFlick UAT using the same plain Dokploy Compose lifecycle as TailorTales.
Alex performs GitHub, Dokploy, Cloudflare, DNS, and all live-environment actions. Automation never
reads, writes, copies, or renders the Compose resource's environment block.

## Security prerequisite

Use a maintained Dokploy release that addresses the published advisories relevant to authenticated
Compose and server operations. Keep Dokploy administration private and grant the workflow API key
only access to read and deploy the UAT Compose resource.

See the official [Dokploy releases](https://github.com/Dokploy/dokploy/releases),
[Compose API reference](https://docs.dokploy.com/docs/api/reference-compose), and
[security advisories](https://github.com/Dokploy/dokploy/security/advisories) before provisioning.

## Configure GitHub

1. Add repository variable `DOKPLOY_URL` with the HTTPS Dokploy origin; do not include credentials,
   a path, query parameters, or a fragment.
2. Add repository variable `DOKPLOY_UAT_COMPOSE_ID` with the UAT Compose resource identifier.
3. Add repository secret `DOKPLOY_API_TOKEN` with least-privilege read/deploy access.
4. Protect Dokploy with Cloudflare Access and add the UAT deployment service-token credentials as
   `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
5. Add repository variable `PLAYWRIGHT_BASE_URL=https://uat.pick-flick.app`.

Dokploy Auto Deploy remains off. After CI succeeds for a push to `main`, the workflow confirms that
`main` has not advanced, triggers the configured UAT Compose resource, waits for the new Dokploy
deployment record, verifies HTTPS liveness/readiness, and runs desktop/mobile browser smoke. It
never creates tags, changes the Compose branch, or saves its environment text.

## Provision Dokploy UAT

1. Create a dedicated PickFlick UAT project plus UAT-only managed PostgreSQL and Redis resources.
   Disable their external ports.
2. Ensure the Compose resource and managed data resources attach to Dokploy's shared
   `dokploy-network`. The repository fixes this name in `compose.deploy.yaml`; do not add a
   `DOKPLOY_NETWORK` environment variable.
3. Create a UAT-only MinIO bucket and application access key. Configure a domain-restricted Resend
   sending key and verified UAT sender. Use only synthetic data.
4. Create a Docker Compose resource with this immutable configuration:

| Setting | Value |
| --- | --- |
| Source | GitHub |
| Owner/repository | `Shagon1k/PickFlick` |
| Branch | `main` |
| Auto deploy | Off |
| Compose type | Docker Compose, not Stack |
| Compose path | `compose.deploy.yaml` |
| Isolated deployment | Off |
| Custom Command | Empty |

`compose.deploy.yaml` owns release ordering: `release` completes successfully before `api` and
`worker`; `web` waits for API health. Dokploy's standard Compose deployment is the sole runtime
lifecycle.

Enter runtime values directly in the Compose resource's **Environment** editor. This resource-owned
block is the source of truth and must not be replaced by CI. At minimum it requires:

```text
APP_ENV=uat
DATABASE_URL
REDIS_URL
RESEND_API_KEY
RESEND_FROM
STORAGE_ENDPOINT=https://storage-uat.pick-flick.app
STORAGE_FORCE_PATH_STYLE=true
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
STORAGE_BUCKET
```

Use a dedicated bucket and application credentials; do not give the application the MinIO root
identity. Route only the MinIO S3 API port `9000` through Dokploy and Cloudflare. Keep its console
private. `RESEND_API_KEY` is server-only and should be restricted to the verified sender domain.

Before the first deployment, use Dokploy's Compose preview. Confirm that only `release`, `api`,
`worker`, and `web` exist and none has a host-published port.

## Configure ingress

Create one Dokploy domain route for `uat.pick-flick.app` to `web:3000`. Next.js rewrites `/api/*`
to the private API alias, so API needs no public Dokploy domain. Add
`storage-uat.pick-flick.app` to MinIO API port `9000`; do not expose the console, PostgreSQL,
Redis, or raw application ports.

## Verify the first deployment

After the workflow is explicitly re-enabled and CI succeeds for a push to `main`:

1. Record the triggering main SHA and the new Dokploy deployment record.
2. Confirm `https://uat.pick-flick.app/api/health/live` is alive and
   `https://uat.pick-flick.app/api/health/ready` reports every dependency as up.
3. Confirm valid HTTPS and HTTP-to-HTTPS redirect.
4. Confirm desktop and mobile Playwright smoke pass; compare the uploaded screenshots with live UAT.
5. From outside the Dokploy host, confirm managed PostgreSQL and Redis ports are unreachable.

Standard Dokploy Compose may replace existing containers during convergence. A failed release blocks
new `api`, `worker`, and `web` services through native dependencies; it does not promise that the
old runtime remains untouched. Recover failed releases by restoring the corrected environment and
running an explicitly approved deployment. Do not paste environment values, connection URLs, tokens,
or raw provider responses into evidence.
