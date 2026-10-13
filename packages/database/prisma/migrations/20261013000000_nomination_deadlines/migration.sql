-- CreateEnum
CREATE TYPE "NominationDeadlineOutcome" AS ENUM ('EMPTY', 'WATCHING', 'SELECTION');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "deadlineVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "NominationDeadlineJob" (
    "sessionId" UUID NOT NULL,
    "deadlineVersion" INTEGER NOT NULL,
    "phaseVersion" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "NominationDeadlineJob_pkey" PRIMARY KEY ("sessionId","deadlineVersion")
);

-- CreateTable
CREATE TABLE "NominationDeadlineDecision" (
    "sessionId" UUID NOT NULL,
    "deadlineVersion" INTEGER NOT NULL,
    "outcome" "NominationDeadlineOutcome" NOT NULL,
    "nominationCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NominationDeadlineDecision_pkey" PRIMARY KEY ("sessionId","deadlineVersion")
);

-- CreateTable
CREATE TABLE "NominationDeadlineNotification" (
    "sessionId" UUID NOT NULL,
    "deadlineVersion" INTEGER NOT NULL,
    "membershipId" UUID NOT NULL,

    CONSTRAINT "NominationDeadlineNotification_pkey" PRIMARY KEY ("sessionId","deadlineVersion","membershipId")
);

-- CreateIndex
CREATE INDEX "NominationDeadlineJob_finishedAt_deadlineAt_idx" ON "NominationDeadlineJob"("finishedAt", "deadlineAt");

-- CreateIndex
CREATE INDEX "NominationDeadlineNotification_membershipId_idx" ON "NominationDeadlineNotification"("membershipId");

-- AddForeignKey
ALTER TABLE "NominationDeadlineJob" ADD CONSTRAINT "NominationDeadlineJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationDeadlineDecision" ADD CONSTRAINT "NominationDeadlineDecision_sessionId_deadlineVersion_fkey" FOREIGN KEY ("sessionId", "deadlineVersion") REFERENCES "NominationDeadlineJob"("sessionId", "deadlineVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationDeadlineNotification" ADD CONSTRAINT "NominationDeadlineNotification_sessionId_deadlineVersion_fkey" FOREIGN KEY ("sessionId", "deadlineVersion") REFERENCES "NominationDeadlineDecision"("sessionId", "deadlineVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationDeadlineNotification" ADD CONSTRAINT "NominationDeadlineNotification_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

