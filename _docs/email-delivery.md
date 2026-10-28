# Notification email operations

Use this guide to configure delivery, inspect failures and generate the owner-selected Card previews.
[ADR-020](decisions/README.md#adr-020--dispatch-notification-email-from-postgresql) records the retry
boundary. The [environment reference](environment.md#runtime-variables) owns variable contracts.

## Configure UAT before rollout

Repository changes do not configure Resend or Dokploy. The owner manages these settings; this guide
records the required configuration without authorizing a deployment or provider change.

1. Verify `pick-flick.app` in Resend and use the UAT-only sending key.
2. Set `RESEND_FROM="PickFlick UAT <uat@pick-flick.app>"` and
   `CONTACT_DELIVERY_TO=test@pick-flick.app` in Dokploy. Production retains
   `PickFlick <notifications@pick-flick.app>` and `hello@pick-flick.app`.
3. Configure a Resend webhook for `https://uat.pick-flick.app/api/webhooks/resend` with
   `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`,
   `email.failed` and `email.suppressed`. Keep open/click tracking disabled; the application adds
   no tracking pixels or rewritten links.
4. Store that endpoint's signing secret in the backend's `RESEND_WEBHOOK_SECRET`. Do not copy it
   into chat, logs, a PR or the email worker. The live API refuses to start without it.
5. Apply migrations through 35 before starting this revision. The new `email-worker` service uses
   the existing worker image with `node dist/email-worker.js`, waits for release and backend
   readiness, and has no port or Redis connection. Claims also recover pending intent committed by
   old API instances after the migration backfill. Local/test/preview modes never claim jobs.

The worker uses a sending-only key and never calls provider management APIs. The API verifies the
raw webhook body using the installed SDK before parsing supported fields. Receipt IDs prevent
replay side effects. See [Resend signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

## Generate template previews

From a clean checkout of the candidate revision:

```sh
pnpm email:preview
```

Open the catalog path printed by the command. It uses a private temporary directory. It links sixteen events in both available and
unavailable states, with matching text files. The renderer is the same one the worker calls.
The index records HEAD and adds an explicit marker if the worktree is dirty. The command performs
no network send. Inactivity and billing examples represent reserved events, not new producers.

For acceptance, host the generated catalog from the final clean SHA on the approved isolated preview
and record that SHA, URL, recipient-inbox rendering evidence and the owner's acknowledgement on
#62. A local catalog or approval of the draft composition does not meet the hosted-preview gate.
Browser inspection does not prove Gmail, Apple Mail or Outlook behavior.

## Inspect delivery and alerts

`ACCEPTED` means Resend accepted the request; `DELIVERED` requires a signed callback. Provider mail
server retries after acceptance belong to Resend; `email.delivery_delayed` never resends the logical
mail through the application. Suppression also blocks mandatory service email; the inbox remains
available under its captured channel policy.

Use aggregated database queries for counts without exposing recipient addresses or message content:

```sql
SELECT "status", "reason", count(*)
FROM "NotificationEmailDelivery"
GROUP BY "status", "reason";

SELECT "status", "attempt", count(*)
FROM "NotificationDeliveryAttempt"
WHERE "channel" = 'EMAIL'
GROUP BY "status", "attempt";

SELECT count(*) AS overdue_claims
FROM "NotificationEmailDelivery"
WHERE "status" = 'PROCESSING' AND "leaseUntil" < now();

SELECT count(*) AS unconfirmed_alerts
FROM "NotificationEmailDelivery"
WHERE "alertAttemptedAt" IS NOT NULL AND "alertSentAt" IS NULL;

SELECT "reason", count(*) FROM "NotificationEmailSuppression" GROUP BY "reason";
```

Structured events include `email.accepted`, `email.retry_scheduled`, `email.failed`,
`email.suppressed`, provider delivery event names, `email.alert_sent` and `email.alert_failed`.
They contain notification IDs, attempt numbers and fixed reason codes, without email addresses,
bodies, provider error text, tokens or raw invitation links. Worker cycle failures remain visible as
`email.cycle.failed`; stale heartbeat health becomes unhealthy. Independent monitoring before
production launch must consume the database/log signals; email alerts depend on Resend too.

Final failure, bounce, complaint and provider suppression each make a delivery eligible for one
best-effort operator alert to `CONTACT_DELIVERY_TO`. The alert contains the notification ID only.
`alertSentAt` records provider acceptance of that alert, not inbox receipt. The worker reserves the
alert attempt before sending, so a crash at that point or provider failure can lose the email signal;
its database record remains. Alerts never generate new notification jobs or recursive alerts.

## Investigate before any manual recovery

Automatic sends use `notification/<UUID>` and the same payload hash. Six claims use delays of
1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours. Claims stop sending after 23 hours from the
first claim, within the provider's [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).
A two-minute abandoned lease can be claimed by another worker; a fencing token prevents the old
worker from overwriting the new result.

`request_changed` means the recipient, authorization projection, template or sender changed after
an uncertain request. `retry_window_exhausted` means the old result must be investigated rather than
resent. Correlate the notification ID with Resend's notification tag and delivery record. Never
clear a delivery, regenerate its idempotency key or delete a suppression merely to force a retry.
No automatic manual-resend or suppression-removal path is provided by this issue.

## Remaining live verification for #62

Use only synthetic registered test accounts and the approved inbox `test@pick-flick.app` for actual
mail. Once the owner has configured and verified the provider, record real sandbox acceptance,
confirmed delivery callbacks, bounce/complaint/suppression behavior and final-failure alert evidence.
Review HTML and text in representative email clients and inspect the provider/application logs for
content leaks. Do not mark the issue complete until these checks and exact-head hosted visual
acknowledgement are recorded. This repository's fake-provider tests do not replace those checks.
