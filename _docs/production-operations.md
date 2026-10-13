# Production preparation and promotion

How production stays inactive, how to provision it when approved, and how to promote, roll back,
and recover. Activating production and every production deployment need an explicit owner decision.

| Work                                                                                       | Issue                                                    |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Promotion controls and this runbook; rehearse with `PRODUCTION_DEPLOY_ENABLED=false`.      | [#16](https://github.com/Shagon1k/PickFlick/issues/16)   |
| Provision the production project, data, storage, secrets, backups, providers, and domains. | [#94](https://github.com/Shagon1k/PickFlick/issues/94)   |
| Deploy the approved revision in one release window and decide whether to serve traffic.    | [#95](https://github.com/Shagon1k/PickFlick/issues/95)   |
| Registry-published digests, only if separate build and deployment hosts need them.         | [#115](https://github.com/Shagon1k/PickFlick/issues/115) |

## Keep production inactive

- Keep the repository variable `PRODUCTION_DEPLOY_ENABLED` absent or `false`.
- Keep Dokploy auto deploy off on the production Compose resource.
- Attach no public domain to the production `frontend` service.
- Protect the GitHub `production` environment with a required owner reviewer.

`promote-production.yml` always validates the candidate. When the guard is not exactly `true`, the
deploy job is skipped, so nothing can create a tag, change Dokploy, or deploy. After environment
approval the deploy job reads the guard again and stops unless it is still `true`.

## Provision production (#94, after owner approval)

Do not copy any value from UAT.

1. Create a separate production Dokploy project.
2. Create a production PostgreSQL resource with its external port disabled.
3. Create a production bucket and credentials. Production is expected to use AWS S3 with
   `STORAGE_FORCE_PATH_STYLE=false`.
4. Attach PostgreSQL and the Compose resource to Dokploy's `dokploy-network`.
5. Create a GitHub-backed Docker Compose resource for `Shagon1k/PickFlick` with Compose path
   `compose.deploy.yaml`, initial ref `main`, and auto deploy off. Do not deploy it.
6. Create the protected GitHub environment `production` and store its settings there:

| Setting                                          | Where                                                  | Purpose                                                |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `PRODUCTION_DEPLOY_ENABLED`                      | Repository variable (set `false` now, required by #16) | Only exact `true` enables deployment.                  |
| `DOKPLOY_URL`, `DOKPLOY_PRODUCTION_COMPOSE_ID`   | `production` environment variables                     | Dokploy origin and the production resource.            |
| `DOKPLOY_API_TOKEN`                              | `production` environment secret                        | Read, update, and deploy access to that resource only. |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | `production` environment secrets                       | Cloudflare Access service token for the Dokploy API.   |

These never go into `.env`, `.env.example`, or the application environment.

7. Enter the application environment in Dokploy with `APP_ENV=production` and production-only
   database, storage, and Resend credentials. The [environment reference](environment.md#runtime-variables)
   lists every variable. Use `RESEND_FROM="PickFlick <notifications@pick-flick.app>"`, a sending-only
   key restricted to `pick-flick.app`, and `CONTACT_DELIVERY_TO=hello@pick-flick.app`.
8. Open the Compose preview and confirm that only `release`, `backend`, `worker`, and `frontend` exist, none
   publishes a host port, and every alias starts with `pickflick-production-`. Do not save it.

Check before activation:

- PostgreSQL and storage credentials select only production resources; PostgreSQL has no public
  port; the bucket holds no UAT or local data.
- `RESEND_FROM` and `CONTACT_DELIVERY_TO` match exactly; no UAT key or sender is present.
- Google Workspace receives `hello@pick-flick.app` and direct mail to the sender address.
- SPF and DKIM pass for Google Workspace and Resend. DMARC starts in monitoring mode and moves to
  `quarantine` or `reject` only after every legitimate sender passes.
- No secret appears in build arguments, Compose source, workflow output, or saved previews.

## Rehearse a promotion while disabled

Run **Promote to Production** and choose `patch`, `minor`, or `major`. The workflow resolves current
`main`, finds the highest stable `vMAJOR.MINOR.PATCH` tag (or `v0.0.0`), reuses it if it already
names `main` or increments the chosen part, requires the latest `UAT E2E` check for that revision to
have passed, and writes the candidate to the run summary. With the guard off, the deploy job is
skipped. Confirm that no tag was created and Dokploy kept its ref and has no new deployment.

## Promote an approved release (#95)

1. Complete the Go/No-Go checklist, provider setup, backup check, and migration review.
2. Confirm current `main` is the healthy UAT revision the owner accepts.
3. Confirm production auto deploy is off and no deployment is running.
4. Set `PRODUCTION_DEPLOY_ENABLED=true` for the release window only.
5. Run **Promote to Production** and approve the `production` environment.
6. Confirm the workflow created or reused the annotated tag, pinned Dokploy to it, deployed, and saw
   `https://pick-flick.app/api/health/live` report the release SHA with every dependency ready.
7. Set `PRODUCTION_DEPLOY_ENABLED` back to `false`.
8. Verify production before attaching or restoring public traffic.

After approval, the deploy job re-checks the guard and fetches `main` before changing anything. If
the guard was turned off or `main` moved, it stops: run the whole workflow again for the new
revision. Never create a release tag from a workstation.

## Review migration compatibility

The `release` service runs migrations, then the required seed step; `backend` and `worker` wait for it, and
`frontend` waits for backend health. Before each release:

1. Review every migration against the currently deployed revision.
2. Use expand-first changes that work with both the current and the candidate runtime.
3. Record the backup and restore point for any migration that changes stored data.
4. Clean up destructive contract changes in a later release, once the old runtime is gone.
5. Fix forward when the applied schema cannot run the previous tag.

A failed release keeps the candidate `backend` and `frontend` from starting, but Dokploy may already
have replaced containers: this topology promises neither zero downtime nor the old runtime.

## Roll back a release

Rollback never reverses migrations. Use it only when the applied schema and seed state still work
with the older tag.

1. Stop and assess. Keep `PRODUCTION_DEPLOY_ENABLED=false` until the owner approves recovery.
2. Pick a previously deployed tag with recorded UAT evidence.
3. Confirm schema compatibility; if unsure, fix forward instead.
4. Pin the production resource to that tag with auto deploy off.
5. Start one manual deployment and wait for it.
6. Verify the release job, backend readiness, worker heartbeat health, frontend health, and critical smoke paths.
7. Restore traffic only after those checks pass.
8. Record the failed tag, restored tag, migration boundary, deployment record, and follow-up.

Never delete or move a release tag, run `prisma migrate reset`, or restore a database just to make an
old image start.

## Recover a partial promotion

The workflow retries safely only until Dokploy is pinned to the candidate:

- A failure before tagging changes nothing.
- If tagging succeeded but pinning failed, the next run reuses the tag while it still names `main`.
- If the tag name already points at another revision, the workflow stops before touching Dokploy.
- If Dokploy is already pinned to the release, every later run stops so an ambiguous earlier run is
  never deployed twice. Inspect the resource and deployment records, then the owner chooses a manual
  recovery.
- If the deployment started and failed, keep its logs and record, then apply the migration and
  rollback rules above instead of deploying again unreviewed.

Evidence may include revisions, tags, workflow and deployment record IDs, statuses, and redacted
check results. Never record environment values, connection URLs, tokens, private keys, or raw
provider responses.

## Deadline worker operations

Apply migration 18 before starting the candidate API and `worker`. Check the worker's Compose
heartbeat health and `deadline.worker.started` / `deadline.reconciliation` events after release.
An overdue Nomination with missing scheduling intent is repaired on startup; completed empty
intent stays handled. Archived Clubs resume pending work after reactivation. Restarting the worker
retries unfinished transactions; do not delete jobs or decision records to force a retry.

`deadline.failure` indicates a pending database transaction failure. Check PostgreSQL availability
and applied migrations, then inspect repair and outcome events after recovery. Recipient rows retain
operator-alert or participant-notification intent; transport remains later work. Production activation
still requires its existing authorization and promotion guards.
