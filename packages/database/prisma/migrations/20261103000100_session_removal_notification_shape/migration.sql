-- A Session removal notice links to its Session; the new enum value is usable only after the
-- previous migration commits.
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_check2";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_check2" CHECK (
  CASE
    WHEN "event" = 'BILLING_SERVICE' THEN num_nonnulls("clubId", "sessionId", "awardId") = 0
    WHEN "event" = 'ACHIEVEMENT_EARNED' THEN "awardId" IS NOT NULL AND "sessionId" IS NULL
    WHEN "event" IN ('SESSION_STARTED', 'SELECTION_OPENED', 'SELECTION_CLOSED', 'RATING_OPENED', 'RATING_CLOSED', 'SESSION_CANCELLED', 'SESSION_PARTICIPANT_REMOVED', 'NOMINATION_STALLED')
      THEN "sessionId" IS NOT NULL AND "awardId" IS NULL
    ELSE "clubId" IS NOT NULL AND "sessionId" IS NULL AND "awardId" IS NULL
  END
);
