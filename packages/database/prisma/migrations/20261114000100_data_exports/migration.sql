CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

CREATE TABLE "DataExportJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "claimToken" UUID,
    "signingKey" TEXT NOT NULL,
    "objectKey" TEXT,
    "failure" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    CONSTRAINT "DataExportJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DataExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DataExportJob_attemptCount_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "DataExportJob_ready_check" CHECK (
        "status" <> 'READY' OR ("objectKey" IS NOT NULL AND "completedAt" IS NOT NULL AND "expiresAt" IS NOT NULL AND "expiresAt" > "completedAt")
    )
);
CREATE UNIQUE INDEX "DataExportJob_userId_requestId_key" ON "DataExportJob"("userId", "requestId");
CREATE UNIQUE INDEX "DataExportJob_one_active_user" ON "DataExportJob"("userId") WHERE "status" IN ('PENDING', 'PROCESSING');
CREATE INDEX "DataExportJob_status_nextAttemptAt_idx" ON "DataExportJob"("status", "nextAttemptAt");
CREATE INDEX "DataExportJob_status_leaseUntil_idx" ON "DataExportJob"("status", "leaseUntil");

CREATE TABLE "DataExportObject" (
    "key" TEXT NOT NULL,
    "jobId" UUID NOT NULL,
    "deleteAfter" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DataExportObject_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "DataExportObject_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DataExportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DataExportObject_deleteAfter_idx" ON "DataExportObject"("deleteAfter");
