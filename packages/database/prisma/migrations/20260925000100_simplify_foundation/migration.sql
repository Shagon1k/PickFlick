-- Contact submissions are sent straight to Resend; the delivery outbox is no longer used.
DROP TABLE "ContactMessage";
DROP TYPE "ContactDeliveryState";

-- Club operations are no longer replayed by operation ID, and Admin transfer waits for the App
-- Admin phase. The row shape is the application's concern, so the shape check goes too.
ALTER TABLE "ClubAuditEvent"
  DROP CONSTRAINT "ClubAuditEvent_shape_check",
  DROP CONSTRAINT "ClubAuditEvent_previousAdminUserId_fkey",
  DROP COLUMN "operationId",
  DROP COLUMN "requestHash",
  DROP COLUMN "previousAdminUserId",
  DROP COLUMN "previousAdminNextRole";

-- Apple display names come from the account email; the first-return profile handoff is gone.
ALTER TABLE "ProviderAccount"
  DROP COLUMN "providerEmail",
  DROP COLUMN "providerDisplayName";
