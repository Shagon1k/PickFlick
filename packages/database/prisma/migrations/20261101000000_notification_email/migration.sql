ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'ACCEPTED';

CREATE TABLE "NotificationEmailDelivery" (
  "notificationId" UUID PRIMARY KEY REFERENCES "Notification"("id") ON DELETE CASCADE,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0 CHECK ("attemptCount" >= 0),
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstAttemptAt" TIMESTAMPTZ(3),
  "leaseUntil" TIMESTAMPTZ(3),
  "claimToken" UUID,
  "requestHash" TEXT,
  "recipientHash" TEXT,
  "providerId" TEXT UNIQUE,
  "reason" TEXT,
  "alertAttemptedAt" TIMESTAMPTZ(3),
  "alertSentAt" TIMESTAMPTZ(3)
);
CREATE INDEX "NotificationEmailDelivery_status_nextAttemptAt_idx"
  ON "NotificationEmailDelivery"("status", "nextAttemptAt");
CREATE TABLE "NotificationEmailSuppression" (
  "addressHash" TEXT PRIMARY KEY,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "NotificationEmailWebhook" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Resume opted-in intent that predates the dispatcher, without reviving terminal attempts.
INSERT INTO "NotificationEmailDelivery" ("notificationId")
SELECT "notificationId" FROM "NotificationDeliveryAttempt"
WHERE "channel" = 'EMAIL' AND "status" = 'PENDING' AND "attempt" = 1;
