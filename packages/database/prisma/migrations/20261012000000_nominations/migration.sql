BEGIN;

-- AlterEnum
ALTER TYPE "ClubAuditAction" ADD VALUE 'SESSION_NOMINATION_CLOSED';
-- CreateTable
CREATE TABLE "Nomination" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Nomination_sessionId_submittedAt_idx" ON "Nomination"("sessionId", "submittedAt");
-- CreateIndex
CREATE UNIQUE INDEX "Nomination_participantId_sessionId_key" ON "Nomination"("participantId", "sessionId");
-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_id_sessionId_key" ON "SessionParticipant"("id", "sessionId");
-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_participantId_sessionId_fkey" FOREIGN KEY ("participantId", "sessionId") REFERENCES "SessionParticipant"("id", "sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
