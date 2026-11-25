CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAYMENT_OVERDUE', 'PAUSED', 'ENDED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO');
ALTER TABLE "AccountDeletion" ALTER COLUMN "billing" SET DEFAULT 'PENDING';

CREATE TABLE "Subscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerPriceId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus",
    "periodStart" TIMESTAMPTZ(3),
    "periodEnd" TIMESTAMPTZ(3),
    "paidThrough" TIMESTAMPTZ(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "checkoutRequestId" UUID,
    "checkoutStartedAt" TIMESTAMPTZ(3),
    "providerCheckoutId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Subscription_period_check" CHECK ("periodEnd" IS NULL OR "periodStart" < "periodEnd"),
    CONSTRAINT "Subscription_checkout_check" CHECK (("checkoutRequestId" IS NULL) = ("checkoutStartedAt" IS NULL)),
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Subscription_provider_providerCustomerId_key" ON "Subscription"("provider", "providerCustomerId");
CREATE UNIQUE INDEX "Subscription_provider_providerSubscriptionId_key" ON "Subscription"("provider", "providerSubscriptionId");
CREATE UNIQUE INDEX "Subscription_provider_providerCheckoutId_key" ON "Subscription"("provider", "providerCheckoutId");

CREATE TABLE "BillingAuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscriptionId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingAuditEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BillingAuditEvent_subscriptionId_createdAt_idx" ON "BillingAuditEvent"("subscriptionId", "createdAt");
