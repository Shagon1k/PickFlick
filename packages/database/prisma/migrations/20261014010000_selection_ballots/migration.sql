BEGIN;

-- Wait for SELECT FOR UPDATE writers before taking the Nomination DDL lock.
LOCK TABLE "Session" IN EXCLUSIVE MODE;

ALTER TABLE "Nomination" ADD COLUMN "isInSelection" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Nomination_id_sessionId_key" ON "Nomination"("id", "sessionId");

-- Capture the same snapshot even when an earlier API or worker opens Selection during rollout.
CREATE FUNCTION snapshot_selection_nominations() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Nomination" AS nomination SET "isInSelection" = true
  FROM "SessionParticipant" AS participant
  WHERE nomination."sessionId" = NEW.id AND nomination."participantId" = participant.id
    AND participant.status = 'ACCEPTED';
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Session_snapshot_selection_nominations"
AFTER UPDATE OF phase ON "Session"
FOR EACH ROW WHEN (OLD.phase <> 'SELECTION' AND NEW.phase = 'SELECTION')
EXECUTE FUNCTION snapshot_selection_nominations();

-- Existing Selection Sessions inherit the eligible nominations at migration time.
UPDATE "Nomination" AS nomination SET "isInSelection" = true
FROM "Session" AS session, "SessionParticipant" AS participant
WHERE nomination."sessionId" = session.id AND nomination."participantId" = participant.id
  AND session.phase = 'SELECTION' AND participant.status = 'ACCEPTED';

CREATE TABLE "SelectionBallot" (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "sessionId" UUID NOT NULL REFERENCES "Session"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "participantId" UUID NOT NULL,
  "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("participantId", "sessionId") REFERENCES "SessionParticipant"(id, "sessionId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SelectionBallot_participantId_sessionId_key" ON "SelectionBallot"("participantId", "sessionId");
CREATE UNIQUE INDEX "SelectionBallot_id_sessionId_key" ON "SelectionBallot"(id, "sessionId");
CREATE INDEX "SelectionBallot_sessionId_idx" ON "SelectionBallot"("sessionId");

CREATE TABLE "SelectionScore" (
  "ballotId" UUID NOT NULL,
  "nominationId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  PRIMARY KEY ("ballotId", "nominationId"),
  FOREIGN KEY ("ballotId", "sessionId") REFERENCES "SelectionBallot"(id, "sessionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("nominationId", "sessionId") REFERENCES "Nomination"(id, "sessionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMIT;
