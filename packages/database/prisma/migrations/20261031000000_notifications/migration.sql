BEGIN;
CREATE TYPE "NotificationEvent" AS ENUM ('SESSION_STARTED', 'SELECTION_OPENED', 'SELECTION_CLOSED', 'RATING_OPENED', 'RATING_CLOSED', 'SESSION_CANCELLED', 'NOMINATION_STALLED', 'MEMBERSHIP_JOINED', 'MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP_REMOVED', 'MEMBERSHIP_LEFT', 'CLUB_ARCHIVED', 'CLUB_REACTIVATED', 'ACHIEVEMENT_EARNED', 'CLUB_INACTIVITY_WARNING', 'BILLING_SERVICE');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'SUPPRESSED');
CREATE TABLE "Notification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "event" "NotificationEvent" NOT NULL,
  "sourceId" UUID NOT NULL,
  "occurrence" INTEGER NOT NULL DEFAULT 1 CHECK ("occurrence" > 0),
  "clubId" UUID,
  "sessionId" UUID,
  "awardId" UUID,
  "inApp" BOOLEAN NOT NULL,
  "email" BOOLEAN NOT NULL,
  "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("sessionId" IS NULL OR "clubId" IS NOT NULL),
  CHECK ("event" <> 'BILLING_SERVICE' OR ("inApp" AND "email")),
  CHECK (
    CASE
      WHEN "event" = 'BILLING_SERVICE' THEN num_nonnulls("clubId", "sessionId", "awardId") = 0
      WHEN "event" = 'ACHIEVEMENT_EARNED' THEN "awardId" IS NOT NULL AND "sessionId" IS NULL
      WHEN "event" IN ('SESSION_STARTED', 'SELECTION_OPENED', 'SELECTION_CLOSED', 'RATING_OPENED', 'RATING_CLOSED', 'SESSION_CANCELLED', 'NOMINATION_STALLED')
        THEN "sessionId" IS NOT NULL AND "awardId" IS NULL
      ELSE "clubId" IS NOT NULL AND "sessionId" IS NULL AND "awardId" IS NULL
    END
  )
);
CREATE UNIQUE INDEX "Notification_recipientId_event_sourceId_occurrence_key" ON "Notification"("recipientId", "event", "sourceId", "occurrence");
CREATE INDEX "Notification_recipientId_inApp_createdAt_id_idx" ON "Notification"("recipientId", "inApp", "createdAt", "id");
CREATE TABLE "NotificationPreference" (
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "event" "NotificationEvent" NOT NULL,
  "inApp" BOOLEAN NOT NULL,
  "email" BOOLEAN NOT NULL,
  PRIMARY KEY ("userId", "event"),
  CHECK ("event" <> 'BILLING_SERVICE' OR ("inApp" AND "email"))
);
CREATE TABLE "NotificationDeliveryAttempt" (
  "notificationId" UUID NOT NULL REFERENCES "Notification"("id") ON DELETE CASCADE,
  "channel" "NotificationChannel" NOT NULL,
  "attempt" INTEGER NOT NULL CHECK ("attempt" > 0),
  "status" "NotificationDeliveryStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("notificationId", "channel", "attempt"),
  CHECK (("status" = 'PENDING') = ("completedAt" IS NULL))
);
CREATE INDEX "NotificationDeliveryAttempt_channel_status_createdAt_idx" ON "NotificationDeliveryAttempt"("channel", "status", "createdAt");
COMMIT;
