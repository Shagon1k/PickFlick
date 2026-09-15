CREATE TYPE "ContactDeliveryState" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

CREATE TABLE "ContactMessage" (
    "id" UUID NOT NULL,
    "submissionKey" UUID NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "message" TEXT,
    "name" TEXT,
    "email" TEXT,
    "deliveryState" "ContactDeliveryState" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingLeaseUntil" TIMESTAMPTZ(3),
    "providerMessageId" TEXT,
    "deliveryErrorCode" TEXT,
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContactMessage_message_length_check" CHECK ("message" IS NULL OR char_length("message") BETWEEN 1 AND 500),
    CONSTRAINT "ContactMessage_name_length_check" CHECK ("name" IS NULL OR char_length("name") BETWEEN 1 AND 100),
    CONSTRAINT "ContactMessage_email_length_check" CHECK ("email" IS NULL OR char_length("email") BETWEEN 3 AND 254),
    CONSTRAINT "ContactMessage_attempt_count_check" CHECK ("attemptCount" BETWEEN 0 AND 5),
    CONSTRAINT "ContactMessage_payload_lifecycle_check" CHECK (
      ("deliveryState" = 'DELIVERED' AND "message" IS NULL AND "name" IS NULL AND "email" IS NULL AND "deliveredAt" IS NOT NULL)
      OR
      ("deliveryState" = 'FAILED' AND "message" IS NULL AND "name" IS NULL AND "email" IS NULL AND "deliveredAt" IS NULL)
      OR
      ("deliveryState" IN ('PENDING', 'PROCESSING') AND "message" IS NOT NULL AND "deliveredAt" IS NULL)
    )
);

CREATE UNIQUE INDEX "ContactMessage_submissionKey_key" ON "ContactMessage"("submissionKey");
CREATE UNIQUE INDEX "ContactMessage_providerMessageId_key" ON "ContactMessage"("providerMessageId");
CREATE INDEX "ContactMessage_sourceHash_createdAt_idx" ON "ContactMessage"("sourceHash", "createdAt");
CREATE INDEX "ContactMessage_deliveryState_nextAttemptAt_idx" ON "ContactMessage"("deliveryState", "nextAttemptAt");
