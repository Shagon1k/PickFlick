BEGIN;

-- The deadline worker reads due Sessions directly; scheduling rows and their reconciliation
-- duplicated Session.deadlineAt and its versions. A decision keeps one row per deadline version.
ALTER TABLE "NominationDeadlineDecision"
  DROP CONSTRAINT "NominationDeadlineDecision_sessionId_deadlineVersion_fkey";
ALTER TABLE "NominationDeadlineDecision"
  ADD CONSTRAINT "NominationDeadlineDecision_sessionId_fkey" FOREIGN KEY ("sessionId")
  REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TABLE "NominationDeadlineJob";

COMMIT;
