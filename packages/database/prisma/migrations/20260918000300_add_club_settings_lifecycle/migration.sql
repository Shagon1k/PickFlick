-- Add the settings and lifecycle state needed by the owner/operator Club controls. Sensitive
-- operations keep their idempotency receipt and categorical audit evidence in one transaction.
BEGIN;

ALTER TABLE "Club"
  ADD COLUMN "avatarObjectKey" TEXT,
  ADD COLUMN "showNominationAuthors" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "showNominationsBeforeSubmit" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "showVoteResults" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "showRatingResults" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "useMonochromeMedia" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

ALTER TABLE "Club" ADD CONSTRAINT "Club_deleted_lifecycle_check"
  CHECK ("deletedAt" IS NULL OR "lifecycle" = 'ARCHIVED');

ALTER TABLE "ClubAuditEvent"
  DROP CONSTRAINT "ClubAuditEvent_changed_role_check",
  DROP CONSTRAINT "ClubAuditEvent_shape_check",
  ALTER COLUMN "previousRole" DROP NOT NULL,
  ALTER COLUMN "nextRole" DROP NOT NULL,
  ADD COLUMN "requestHash" CHAR(64),
  ADD COLUMN "previousLifecycle" "ClubLifecycle",
  ADD COLUMN "nextLifecycle" "ClubLifecycle";

ALTER TABLE "ClubAuditEvent" ADD CONSTRAINT "ClubAuditEvent_shape_check" CHECK (COALESCE((
  (
    "action" = 'MEMBERSHIP_ROLE_CHANGED'
    AND "previousRole" IS NOT NULL
    AND "nextRole" IN ('MODERATOR', 'MEMBER')
    AND (("changed" AND "previousRole" <> "nextRole") OR (NOT "changed" AND "previousRole" = "nextRole"))
    AND "previousLifecycle" IS NULL
    AND "nextLifecycle" IS NULL
    AND "previousAdminUserId" IS NULL
    AND "previousAdminNextRole" IS NULL
  )
  OR (
    "action" = 'ADMIN_TRANSFERRED'
    AND "changed"
    AND "previousRole" IS NOT NULL
    AND "nextRole" = 'ADMIN'
    AND "previousLifecycle" IS NULL
    AND "nextLifecycle" IS NULL
    AND "previousAdminUserId" IS NOT NULL
    AND "previousAdminNextRole" IN ('MODERATOR', 'MEMBER')
  )
  OR (
    "action" IN ('CLUB_SETTINGS_UPDATED', 'CLUB_AVATAR_UPDATED')
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND "previousRole" IS NULL
    AND "nextRole" IS NULL
    AND "previousLifecycle" IS NULL
    AND "nextLifecycle" IS NULL
    AND "previousAdminUserId" IS NULL
    AND "previousAdminNextRole" IS NULL
  )
  OR (
    "action" = 'CLUB_DELETED'
    AND "changed"
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND "previousRole" IS NULL
    AND "nextRole" IS NULL
    AND "previousLifecycle" IS NULL
    AND "nextLifecycle" IS NULL
    AND "previousAdminUserId" IS NULL
    AND "previousAdminNextRole" IS NULL
  )
  OR (
    "action" = 'CLUB_ARCHIVED'
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND "previousRole" IS NULL
    AND "nextRole" IS NULL
    AND "previousLifecycle" IS NOT NULL
    AND "nextLifecycle" = 'ARCHIVED'
    AND (("changed" AND "previousLifecycle" = 'ACTIVE') OR (NOT "changed" AND "previousLifecycle" = 'ARCHIVED'))
    AND "previousAdminUserId" IS NULL
    AND "previousAdminNextRole" IS NULL
  )
  OR (
    "action" = 'CLUB_REACTIVATED'
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND "previousRole" IS NULL
    AND "nextRole" IS NULL
    AND "previousLifecycle" IS NOT NULL
    AND "nextLifecycle" = 'ACTIVE'
    AND (("changed" AND "previousLifecycle" = 'ARCHIVED') OR (NOT "changed" AND "previousLifecycle" = 'ACTIVE'))
    AND "previousAdminUserId" IS NULL
    AND "previousAdminNextRole" IS NULL
  )
  OR (
    "action" = 'MEMBERSHIP_LEFT'
    AND "changed"
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND "previousRole" IN ('MODERATOR', 'MEMBER')
    AND "nextRole" IS NULL
    AND "previousLifecycle" IS NULL
    AND "nextLifecycle" IS NULL
    AND "previousAdminUserId" IS NULL
    AND "previousAdminNextRole" IS NULL
  )
), FALSE));

COMMIT;
