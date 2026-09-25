# Production preparation and promotion

This runbook prepares the PickFlick production contract without creating a release or serving
traffic. Production activation and every production deployment require an explicit owner decision.

## Work ownership

Keep preparation separate from production activation:

| Work                                                                                                                                                             | Owning issue                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Add the checked-in promotion controls and runbooks, keep `PRODUCTION_DEPLOY_ENABLED=false`, and rehearse validation without a tag or deployment.                 | [#16](https://github.com/Shagon1k/PickFlick/issues/16)   |
| Provision the live production project, data services, storage, environment values, secrets, backups, providers, and domains after owner approval.                | [#94](https://github.com/Shagon1k/PickFlick/issues/94)   |
| Enable one approved release window, deploy the accepted revision, verify production, and decide whether to serve traffic.                                        | [#95](https://github.com/Shagon1k/PickFlick/issues/95)   |
| Add registry-published digest promotion if separate build/deployment hosts or another concrete artifact-identity requirement makes source identity insufficient. | [#115](https://github.com/Shagon1k/PickFlick/issues/115) |

Issue #16 does not require a live production resource, production credentials, provider activation,
or a public route. Its production configuration evidence comes from repository-owned validation
with synthetic values and the disabled workflow rehearsal.

## Keep production inactive

Use these controls together:

- Keep the repository variable `PRODUCTION_DEPLOY_ENABLED` absent or set to `false`.
- Keep Dokploy automatic deployment disabled on the production Compose resource.
- Do not attach `pick-flick.app` or another public domain to the production web service.
- Protect the GitHub `production` environment with a required owner reviewer.

The `Promote to Production` workflow always resolves the candidate and verifies its `UAT E2E`
check. When `PRODUCTION_DEPLOY_ENABLED` is not exactly `true`, the deploy job is skipped: nothing can
create a tag, change the Dokploy resource, or start a deployment. After protected-environment
approval the deploy job reads the guard again and stops unless it is still exactly `true`.

## Provision the dormant Dokploy contract

Follow this procedure under issue #94, only after the owner approves production infrastructure
work. It is not a completion step for issue #16. Do not copy values from UAT.

1. Create a separate production Dokploy project.
2. Create a production PostgreSQL resource with its external port disabled.
3. Create a separate production object-storage bucket and credentials. Production is expected to
   use AWS S3 with `STORAGE_FORCE_PATH_STYLE=false`; do not reuse the UAT MinIO bucket.
4. Connect the managed resources and application Compose resource to the production application
   network required by Dokploy routing.
5. Create one GitHub-backed Docker Compose resource for `Shagon1k/PickFlick`.
6. Set its Compose path to `compose.deploy.yaml`, its initial ref to `main`, and automatic deployment
   to disabled. Do not deploy the resource.
7. Leave the production web service without a public domain.

Use Dokploy's Compose preview to render the complete operator-supplied configuration. Confirm that
only `release`, `api`, and `web` exist, no service publishes a host port, and every alias
uses the `pickflick-production-` prefix. Do not save or paste the rendered output because it contains
resolved secret values.

Run the repository-owned static validation separately:

```bash
pnpm compose:check
```

This command uses synthetic values. It proves the checked-in production shape without accessing a
production resource or secret.

## Configure GitHub

For issue #16, create only the repository variable `PRODUCTION_DEPLOY_ENABLED=false`. The disabled
validation job does not read production deployment credentials.

Under issue #94, create a protected GitHub environment named `production` and require an owner
reviewer. Store the production deployment credentials in that environment when production
provisioning is approved.

The workflow uses these settings:

| Setting                         | GitHub storage                    | Required while inactive | Purpose                                                                           |
| ------------------------------- | --------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `PRODUCTION_DEPLOY_ENABLED`     | Repository variable               | Yes; set to `false`     | Fail-closed deployment guard. Only exact lowercase `true` enables the deploy job. |
| `DOKPLOY_URL`                   | `production` environment variable | No                      | HTTPS origin for the Cloudflare-protected Dokploy API.                            |
| `DOKPLOY_PRODUCTION_COMPOSE_ID` | `production` environment variable | No                      | Exact production Compose resource identifier.                                     |
| `DOKPLOY_API_TOKEN`             | `production` environment secret   | No                      | Least-privilege production Compose read/update/deploy access.                     |
| `CF_ACCESS_CLIENT_ID`           | `production` environment secret   | No                      | Cloudflare Access service-token identifier for the Dokploy API.                   |
| `CF_ACCESS_CLIENT_SECRET`       | `production` environment secret   | No                      | Cloudflare Access service-token secret for the Dokploy API.                       |

Do not put these deployment-control values in `.env`, `.env.example`, or the Dokploy application
environment. The workflow receives its short-lived `GITHUB_TOKEN` from GitHub Actions.

## Configure the production application

Supply a production-specific value for every input required by `compose.deploy.yaml`. Set
`APP_ENV=production`. Use distinct database, storage, and Resend identities; do not reuse UAT
credentials or scopes. The [environment reference](environment.md#runtime-variables) defines the
full runtime inventory and marks sensitive values.

Use `RESEND_FROM="PickFlick <notifications@pick-flick.app>"` with a production sending-only key
restricted to `pick-flick.app`. Application email sets `Reply-To` to the public
`hello@pick-flick.app` address. Google Workspace receives public mail, Cloudflare owns authoritative
DNS, Resend sends application mail, and Alex retains administrative ownership and recovery control
for all three providers. Do not configure a personal, UAT, or cross-environment fallback.
Set `CONTACT_DELIVERY_TO=hello@pick-flick.app`.

Before activation, check these boundaries:

- PostgreSQL and object-storage credentials select only production resources.
- Managed PostgreSQL has no externally published port.
- The storage bucket contains no UAT or local data.
- `RESEND_FROM` exactly matches `PickFlick <notifications@pick-flick.app>`.
- `CONTACT_DELIVERY_TO` exactly matches `hello@pick-flick.app`.
- Google Workspace receives `hello@pick-flick.app` and direct mail to the production sender before
  public release.
- The Resend key has sending-only access restricted to `pick-flick.app`; no UAT key or sender is
  present.
- SPF and DKIM pass for both Google Workspace and Resend. Stage DMARC in monitoring mode before
  moving to `quarantine` or `reject` after all legitimate senders pass.
- No secret appears in browser build arguments, Compose source, workflow output, or saved preview
  output.

Live resource provisioning, provider activation, real production data, and traffic cutover are
outside issue #16.

## Validate a promotion while disabled

Run **Promote to Production** manually and choose `patch`, `minor`, or `major`. The workflow:

1. Resolves the current `main` revision.
2. Finds the highest stable `vMAJOR.MINOR.PATCH` tag. With no stable tag, it uses `v0.0.0` as the
   baseline.
3. Reuses the latest tag when it already points to current `main`; otherwise it increments the
   selected component.
4. Requires the latest `UAT E2E` check run for that exact revision to have succeeded.
5. Records the candidate revision and version in the run summary.
6. Skips the deploy job while `PRODUCTION_DEPLOY_ENABLED` is not exactly `true`.

The disabled run is the expected issue #16 rehearsal. Confirm that no release tag was created and
that the Dokploy resource still has its original ref and no deployment record from the workflow.

## Promote an enabled release

Do not enable production during issue #16 or issue #94. Under issue #95, for an approved production
release:

1. Complete the production Go/No-Go checklist, provider setup, backup verification, and migration
   review.
2. Confirm that current `main` is the exact healthy UAT revision the owner accepts.
3. Confirm that the production resource has automatic deployment disabled and no deployment is
   running.
4. Set `PRODUCTION_DEPLOY_ENABLED=true` only for the approved release window.
5. Run **Promote to Production** and approve its protected `production` environment job.
6. Confirm that the workflow creates or reuses the expected annotated SemVer tag, pins Dokploy to
   that tag with automatic deployment disabled, waits for the deployment, and sees
   `https://pick-flick.app/api/health/live` report the release SHA with every dependency ready.
7. Return `PRODUCTION_DEPLOY_ENABLED` to `false` after the workflow finishes.
8. Verify production readiness before attaching or restoring public traffic.

After protected-environment approval, the deploy job reads the production guard again and fetches
`main` immediately before any production mutation. It stops if the guard was disabled or `main`
advanced after validation. Re-run the complete workflow against the new revision; do not bypass
either check or create a tag from a developer machine.

## Review migration compatibility

The `release` service runs committed Prisma migrations before its production-safe required-seed
step. The API waits for `release` to succeed, and web waits for API health.

Before every production release:

1. Review each migration against the currently deployed application revision.
2. Use expand-first changes that remain compatible with both the current and candidate runtime.
3. Record the backup and restore point for a migration that changes stored data.
4. Use a later release for destructive contract cleanup after the old runtime can no longer run.
5. Prefer a forward fix when the applied schema cannot support the previous application tag.

A failed release prevents the candidate API and web services from passing their dependency
gates. Standard Dokploy Compose may already have replaced containers during convergence, so this
topology does not promise zero downtime or preservation of the previous runtime.

## Roll back an application release

Rollback does not reverse database migrations. Use it only when the applied schema and required
seed state remain compatible with the selected older tag.

1. Stop and assess the failed deployment. Keep `PRODUCTION_DEPLOY_ENABLED=false` until the owner
   approves recovery.
2. Select a previously deployed immutable SemVer tag with recorded UAT evidence.
3. Confirm schema compatibility with that tag. If compatibility is uncertain, ship a forward fix.
4. Pin the Dokploy production resource to the approved tag while keeping automatic deployment
   disabled.
5. Start one manual deployment and wait for the correlated deployment record.
6. Verify release completion, API readiness, web health, and critical smoke paths.
7. Restore public traffic only after those checks pass.
8. Record the failed tag, restored tag, applied migration boundary, deployment record, and follow-up.

Never delete a release tag, edit it to point to another revision, run `prisma migrate reset`, or
restore a database merely to make an old application image start.

## Recover partial promotion failures

The workflow permits an automatic retry only before Dokploy is pinned to the candidate release:

- Before tag creation, every failure leaves repository and Dokploy state unchanged.
- If tag creation succeeds but the Dokploy ref update does not, the next run reuses that tag when it
  still points to current `main`.
- If a tag name points to another revision, promotion stops before changing Dokploy.
- If the Dokploy ref update succeeds, every later run stops when it finds the resource already
  pinned to that release. Inspect the resource and deployment records before the owner chooses a
  manual recovery. This stop prevents an ambiguous deploy response from triggering the release
  twice.
- If the deployment starts and fails, preserve its logs and deployment record. Apply the migration
  and rollback rules above; do not hide the failure with another unreviewed deployment.

Evidence may include revision IDs, SemVer tags, workflow/deployment record IDs, statuses, and
redacted check results. Never record environment values, connection URLs, tokens, private keys, or
raw provider responses.
