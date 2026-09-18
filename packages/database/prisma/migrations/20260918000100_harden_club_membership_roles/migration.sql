-- Preserve membership history while enforcing the active Club boundary and recording sensitive
-- role transitions in the same transaction as their state changes.
BEGIN;

ALTER TABLE "Membership" ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Membership" ALTER COLUMN "updatedAt" DROP DEFAULT;

DROP INDEX "Membership_clubId_userId_key";

CREATE INDEX "Membership_clubId_userId_idx" ON "Membership" ("clubId", "userId");

CREATE UNIQUE INDEX "Membership_one_active_per_user_club_key"
  ON "Membership" ("clubId", "userId")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_status_departure_check"
  CHECK (
    ("status" = 'ACTIVE' AND "leftAt" IS NULL)
    OR ("status" IN ('LEFT', 'REMOVED') AND "leftAt" IS NOT NULL)
  );

CREATE TYPE "ClubAuditAction" AS ENUM ('MEMBERSHIP_ROLE_CHANGED', 'ADMIN_TRANSFERRED');

CREATE TABLE "ClubAuditEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operationId" UUID NOT NULL,
  "clubId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "subjectUserId" UUID NOT NULL,
  "subjectMembershipId" UUID NOT NULL,
  "action" "ClubAuditAction" NOT NULL,
  "previousRole" "ClubRole" NOT NULL,
  "nextRole" "ClubRole" NOT NULL,
  "previousAdminUserId" UUID,
  "previousAdminNextRole" "ClubRole",
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClubAuditEvent_changed_role_check" CHECK ("previousRole" <> "nextRole"),
  CONSTRAINT "ClubAuditEvent_shape_check" CHECK (
    (
      "action" = 'MEMBERSHIP_ROLE_CHANGED'
      AND "nextRole" IN ('MODERATOR', 'MEMBER')
      AND "previousAdminUserId" IS NULL
      AND "previousAdminNextRole" IS NULL
    )
    OR (
      "action" = 'ADMIN_TRANSFERRED'
      AND "nextRole" = 'ADMIN'
      AND "previousAdminUserId" IS NOT NULL
      AND "previousAdminNextRole" IN ('MODERATOR', 'MEMBER')
    )
  )
);

CREATE UNIQUE INDEX "ClubAuditEvent_operationId_key" ON "ClubAuditEvent" ("operationId");
CREATE INDEX "ClubAuditEvent_clubId_createdAt_idx" ON "ClubAuditEvent" ("clubId", "createdAt");
CREATE INDEX "ClubAuditEvent_actorUserId_createdAt_idx" ON "ClubAuditEvent" ("actorUserId", "createdAt");
CREATE INDEX "ClubAuditEvent_subjectUserId_createdAt_idx" ON "ClubAuditEvent" ("subjectUserId", "createdAt");
CREATE INDEX "ClubAuditEvent_subjectMembershipId_createdAt_idx" ON "ClubAuditEvent" ("subjectMembershipId", "createdAt");

ALTER TABLE "ClubAuditEvent" ADD CONSTRAINT "ClubAuditEvent_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAuditEvent" ADD CONSTRAINT "ClubAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAuditEvent" ADD CONSTRAINT "ClubAuditEvent_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAuditEvent" ADD CONSTRAINT "ClubAuditEvent_subjectMembershipId_fkey"
  FOREIGN KEY ("subjectMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAuditEvent" ADD CONSTRAINT "ClubAuditEvent_previousAdminUserId_fkey"
  FOREIGN KEY ("previousAdminUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
