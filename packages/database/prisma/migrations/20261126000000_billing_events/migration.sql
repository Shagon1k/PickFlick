ALTER TABLE "Subscription"
  ADD COLUMN "nextReconcileAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastReconciledAt" TIMESTAMPTZ(3),
  ADD COLUMN "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconcileFailure" TEXT;

CREATE INDEX "Subscription_nextReconcileAt_idx" ON "Subscription"("nextReconcileAt");

CREATE TABLE "BillingEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerId" TEXT,
  "paymentId" TEXT,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(3),
  "failure" TEXT,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingEvent_state_check" CHECK ("state" IN ('PENDING', 'PROCESSED', 'IGNORED'))
);
CREATE UNIQUE INDEX "BillingEvent_provider_providerEventId_key" ON "BillingEvent"("provider", "providerEventId");
CREATE INDEX "BillingEvent_state_nextAttemptAt_idx" ON "BillingEvent"("state", "nextAttemptAt");
