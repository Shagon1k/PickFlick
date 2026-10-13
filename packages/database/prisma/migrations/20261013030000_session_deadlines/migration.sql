BEGIN;
ALTER TABLE "NominationDeadlineDecision" DROP CONSTRAINT "NominationDeadlineDecision_sessionId_deadlineVersion_fkey";
ALTER TABLE "NominationDeadlineDecision" ADD CONSTRAINT "NominationDeadlineDecision_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TABLE "NominationDeadlineJob";
CREATE INDEX "Session_nomination_deadline_idx" ON "Session" ("deadlineAt") WHERE phase = 'NOMINATION';
COMMIT;
