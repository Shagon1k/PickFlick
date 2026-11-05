-- Before 2026-11-05 an empty deadline decision left deadlineAt set, so the worker had to skip those
-- rows by their decision. Clearing them lets the worker treat every due deadline as undecided.
UPDATE "Session" AS session
SET "deadlineAt" = NULL, "detailsVersion" = session."detailsVersion" + 1
WHERE session.phase = 'NOMINATION'
  AND session."deadlineAt" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "NominationDeadlineDecision" AS decision
    WHERE decision."sessionId" = session.id
      AND decision."deadlineVersion" = session."deadlineVersion"
  );
